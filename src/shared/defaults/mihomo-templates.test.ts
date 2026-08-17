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
})
