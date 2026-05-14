import { describe, expect, it } from 'vitest'
import { buildRendererCsp } from './csp'

function cspDirective(csp: string, name: string): string[] {
  const directive = csp.split('; ').find((part) => part.startsWith(`${name} `))

  return directive?.split(' ').slice(1) ?? []
}

describe('buildRendererCsp', () => {
  it('allows dev localhost origins and inline scripts for Vite', () => {
    const csp = buildRendererCsp({ isDev: true })

    expect(csp).toContain("script-src 'self' 'unsafe-inline'")
    expect(csp).toContain('http://localhost:*')
    expect(csp).toContain('ws://localhost:*')
  })

  it('keeps production script policy stricter and limits loopback to 127.0.0.1', () => {
    const csp = buildRendererCsp({ isDev: false })

    expect(csp).toContain("script-src 'self'")
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'")
    expect(csp).toContain('http://127.0.0.1:*')
    expect(csp).toContain('ws://127.0.0.1:*')
    expect(csp).not.toContain('http://localhost:*')
    expect(csp).not.toContain('ws://localhost:*')
  })

  it('only allows the known IP checker origins in frames', () => {
    const csp = buildRendererCsp({ isDev: false })
    const frameSrc = cspDirective(csp, 'frame-src')

    expect(frameSrc).toContain("'self'")
    expect(frameSrc).toContain('https://ping0.cc')
    expect(frameSrc).toContain('https://ip.sb')
    expect(frameSrc).not.toContain('http://127.0.0.1:*')
    expect(frameSrc).not.toContain('ws://127.0.0.1:*')
  })
})
