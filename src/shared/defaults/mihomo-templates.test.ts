import { describe, expect, it } from 'vitest'
import { load } from 'js-yaml'

import { MIHOMO_V119_YAML_SNIPPETS } from './mihomo-templates'

describe('Mihomo v1.19 YAML snippets', () => {
  const snippets = new Map(MIHOMO_V119_YAML_SNIPPETS.map((item) => [item.label, item.snippet]))

  it('uses unique completion labels', () => {
    expect(snippets.size).toBe(MIHOMO_V119_YAML_SNIPPETS.length)
  })

  it('contains syntactically valid YAML fragments', () => {
    for (const snippet of snippets.values()) {
      expect(() => load(snippet)).not.toThrow()
    }
  })

  it('covers Mihomo v1.19.30 configuration additions', () => {
    expect(snippets.get('mihomo-zerotier-proxy')).toContain('type: zerotier')
    expect(snippets.get('mihomo-ip-stack-options')).toContain('congestion-controller: bbr3')
    expect(snippets.get('mihomo-amneziawg-v3-options')).toContain('random-trailers: true')
    expect(snippets.get('mihomo-hysteria2-v11930-options')).toContain('handshake-timeout: 30')
    expect(snippets.get('mihomo-openvpn-v11930-options')).toContain('tran-window: 3600')
    expect(snippets.get('mihomo-anytls-client-metadata')).toContain('client-metadata:')
    expect(snippets.get('mihomo-restls-listener-rate-limit')).toContain('rate-limit: 0')
  })

  it('covers Mihomo v1.19.31 configuration additions', () => {
    expect(snippets.get('mihomo-zerotier-proxy')).toContain('identity-secret:')
    expect(snippets.get('mihomo-easytier-proxy')).toContain('type: easytier')
    expect(snippets.get('mihomo-easytier-proxy')).toContain('network-name:')
  })

  it('uses a hashing strategy for inbound-user pinning', () => {
    const groups = load(snippets.get('mihomo-load-balance-in-user')!) as MihomoProxyGroupConfig[]
    expect(groups[0]).toMatchObject({
      type: 'load-balance',
      strategy: 'consistent-hashing',
      'hash-key': 'in-user'
    })
  })

  it('enables MIPS for TUN congestion control', () => {
    const config = load(snippets.get('mihomo-tun-congestion-controller')!) as Partial<MihomoConfig>
    expect(config.tun).toMatchObject({ stack: 'mips', 'congestion-controller': 'cubic' })
  })
})
