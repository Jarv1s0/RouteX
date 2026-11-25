import { describe, expect, it } from 'vitest'
import { diagnoseMihomoYaml } from './mihomo-yaml-diagnostics'
import { completeMihomoYaml } from './mihomo-yaml-completions'
import {
  inspectYaml,
  schemaAtPath,
  yamlCompletionContext,
  stableVersionBefore
} from './mihomo-yaml-schema'

const labels = (text: string) =>
  completeMihomoYaml(text, text.length)?.options.map((option) => option.label) || []
describe('Mihomo YAML language support', () => {
  it('completes nested fields and enums without offering root fields in DNS', () => {
    expect(labels('dns:\n  enh')).toContain('enhanced-mode')
    expect(labels('dns:\n  enh')).not.toContain('proxies')
    expect(labels('dns:\n  enhanced-mode: ')).toContain('fake-ip')
    expect(labels('tun:\n  stack: ')).toContain('mips')
    expect(labels('dns: { enh')).toContain('enhanced-mode')
    expect(labels('dns:\n  "enh')).toContain('enhanced-mode')
    const emptyType = 'proxies:\n  - type: '
    expect(labels(emptyType)).toEqual(expect.arrayContaining(['ss', 'vmess', 'easytier']))
  })
  it('uses discriminators for proxy-specific completions and dynamic provider names', () => {
    const text = 'proxies:\n  - name: local\n    type: ss\n    '
    expect(labels(text)).toContain('cipher')
    expect(labels(text)).not.toContain('uuid')
    expect(labels('proxy-providers:\n  provider:\n    type: http\n    ')).toContain('url')
  })
  it('inserts valid quoted keys with auto-closing quotes and keeps existing values', () => {
    for (const source of [
      'dns:\n  "enh"',
      'dns:\n  "enh": fake-ip',
      'dns:\n  enhanced-mode: fake-ip'
    ]) {
      const position = source.indexOf('enh') + 3
      const result = completeMihomoYaml(source, position)!
      const option = result.options.find((item) => item.label === 'enhanced-mode')!
      expect(option).toBeTruthy()
      const completed = source.slice(0, result.from) + option.apply + source.slice(result.to)
      expect(inspectYaml(completed).document.errors).toEqual([])
      expect(completed).toContain('enhanced-mode')
      expect(completed).toContain(':')
      if (source.includes('fake-ip')) expect(completed).toContain('fake-ip')
    }
  })
  it('reports only required fields for the selected proxy protocol', () => {
    const source =
      'proxies:\n  - name: local\n    type: vmess\n    server: 127.0.0.1\n    port: 443\n    alterId: 0\n    cipher: auto\n'
    const results = diagnoseMihomoYaml(source)
    expect(results.some((item) => item.message.includes('缺少字段 uuid'))).toBe(true)
    expect(results.some((item) => item.message.includes('缺少字段 password'))).toBe(false)
    const ss = diagnoseMihomoYaml(
      'proxies:\n  - name: local\n    type: ss\n    server: 127.0.0.1\n    port: 443\n    password: secret\n    cipher: INVALID\n'
    )
    expect(ss.some((item) => item.message.includes('cipher'))).toBe(true)
    expect(ss.some((item) => /uuid|alterId|private-key/.test(item.message))).toBe(false)
  })
  it('preserves syntax diagnostics and warns on type/enum mistakes at their source ranges', () => {
    expect(diagnoseMihomoYaml('dns: [')).toEqual(
      expect.arrayContaining([expect.objectContaining({ severity: 'error' })])
    )
    const text = 'dns:\n  enable: wrong\n  enhanced-mode: unsupported\n'
    const results = diagnoseMihomoYaml(text)
    expect(results.some((item) => item.message.includes('dns.enable'))).toBe(true)
    expect(results.some((item) => item.message.includes('dns.enhanced-mode'))).toBe(true)
    expect(results.every((item) => item.from >= 0 && item.to <= text.length)).toBe(true)
    expect(results.some((item) => item.message.includes('wrong'))).toBe(false)
  })
  it('checks known minimum versions without inventing an alpha version', () => {
    const config = 'tun:\n  stack: mips\n  dns-mode: native\n'
    expect(
      diagnoseMihomoYaml(config, { version: 'v1.19.31' }).filter((item) =>
        item.message.includes('当前为')
      )
    ).toHaveLength(2)
    expect(
      diagnoseMihomoYaml(config, { version: 'alpha-abc123' }).some((item) =>
        item.message.includes('当前为')
      )
    ).toBe(false)
    expect(stableVersionBefore('v1.19.33', '1.19.32')).toBe(false)
  })
  it('does not treat rule-provider payloads as full Mihomo configs or block unknown keys', () => {
    expect(diagnoseMihomoYaml('payload:\n  - DOMAIN,example.com\n')).toEqual([])
    const unknown = diagnoseMihomoYaml('future-feature: true\n', { mode: 'config' })
    expect(unknown).toEqual([])
    expect(
      diagnoseMihomoYaml('dns:\n  enable: true\n', { mode: 'merge' }).some((item) =>
        item.message.includes('缺少')
      )
    ).toBe(false)
  })
  it('handles flow maps, aliases and quoted keys without offering completions in comments or certificates', () => {
    const parsed = inspectYaml('dns: { "enhanced-mode": fake-ip }\n')
    expect(schemaAtPath(['dns', 'enhanced-mode'], parsed.data)?.enum).toContain('fake-ip')
    expect(yamlCompletionContext('# dns: en', 9)).toBeUndefined()
    const block = 'tls:\n  certificate: |\n    CERTIFICATE'
    expect(yamlCompletionContext(block, block.length)).toBeUndefined()
    expect(
      diagnoseMihomoYaml('dns: &dns\n  enable: true\nother: *dns\n').some(
        (item) => item.severity === 'error'
      )
    ).toBe(false)
  })
  it('accepts custom root anchor definitions while validating their uses', () => {
    const source = [
      "chinaDNS: &chinaDNS ['223.5.5.5#DIRECT', '119.29.29.29#DIRECT']",
      '"defaultDNS": &defaultDNS [114.114.114.114]',
      'proxyServerDNS: &proxyServerDNS',
      '  - tls://223.5.5.5',
      'dnsDefaults: &dnsDefaults { enable: true }',
      'dnsEnabled: &dnsEnabled true',
      'dns:',
      '  <<: *dnsDefaults',
      '  enable: *dnsEnabled',
      '  nameserver: *chinaDNS',
      '  default-nameserver: *defaultDNS',
      '  proxy-server-nameserver: *proxyServerDNS'
    ].join('\n')
    for (const mode of ['auto', 'config', 'merge'] as const) {
      expect(diagnoseMihomoYaml(source, { mode })).toEqual([])
    }
    const invalid = diagnoseMihomoYaml(
      'dnsEnabled: &dnsEnabled wrong\ndns:\n  enable: *dnsEnabled\n'
    )
    expect(invalid.some((item) => item.message.includes('dns.enable'))).toBe(true)
  })
  it('accepts unknown fields like Mihomo while keeping invalid types and YAML diagnostics', () => {
    const source = 'chinaDNS: [223.5.5.5]\ndns:\n  enbale: &enabled true\n  enable: *enabled\n'
    for (const mode of ['auto', 'config', 'merge'] as const) {
      for (const locale of ['zh-CN', 'en-US']) {
        expect(diagnoseMihomoYaml(source, { mode, locale })).toEqual([])
      }
    }
    expect(
      diagnoseMihomoYaml('dns: &dns { enable: wrong }').some((item) =>
        item.message.includes('dns.enable')
      )
    ).toBe(true)
    expect(diagnoseMihomoYaml('dns:\n  nameserver: *missing\n')).toContainEqual(
      expect.objectContaining({ severity: 'warning', message: expect.stringContaining('引用') })
    )
    expect(diagnoseMihomoYaml('chinaDNS: &chinaDNS [')).toContainEqual(
      expect.objectContaining({ severity: 'error' })
    )
  })
  it('locates special-character paths accurately and handles large configs with many schema errors', () => {
    const specialSource = [
      'proxy-providers:',
      '  "a.b/c":',
      '    type: file',
      '    path: 123'
    ].join('\n')
    const invalidValueStart = specialSource.indexOf('123')
    const specialDiags = diagnoseMihomoYaml(specialSource)
    expect(specialDiags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'warning',
          from: invalidValueStart,
          to: invalidValueStart + '123'.length
        })
      ])
    )

    const lines = ['proxies:']
    for (let i = 0; i < 300; i++) {
      lines.push(
        `  - name: node-${i}`,
        '    type: ss',
        '    server: 127.0.0.1',
        '    port: 443',
        '    password: secret',
        i % 5 === 0 ? '    cipher: INVALID' : '    cipher: aes-128-gcm'
      )
    }
    const largeSource = lines.join('\n')
    const largeDiags = diagnoseMihomoYaml(largeSource)
    expect(largeDiags.length).toBeGreaterThanOrEqual(50)
    expect(largeDiags.every((item) => item.from > 0 && item.to > item.from)).toBe(true)
    const firstDiag = largeDiags[0]
    expect(largeSource.slice(firstDiag.from, firstDiag.to)).toBe('INVALID')
  })
})
