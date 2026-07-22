import { describe, expect, it, vi } from 'vitest'

vi.mock('@renderer/api/app', () => ({
  openExternalUrl: vi.fn()
}))

vi.mock('@renderer/utils/mihomo-ipc', () => ({
  mihomoUpgradeUI: vi.fn(),
  restartCore: vi.fn()
}))

vi.mock('@renderer/hooks/use-controled-mihomo-config', () => ({
  useControledMihomoConfig: vi.fn()
}))

vi.mock('@renderer/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

import { buildExternalUiOpenUrl } from './controller-setting'

describe('buildExternalUiOpenUrl', () => {
  it('puts MetaCubeXD connection params in the document query', () => {
    const url = new URL(
      buildExternalUiOpenUrl(
        '127.0.0.1:9090',
        'ui',
        'https://github.com/MetaCubeX/metacubexd/archive/refs/heads/gh-pages.zip',
        'token'
      )
    )

    expect(url.hostname).toBe('localhost')
    expect(url.pathname).toBe('/ui/')
    expect(url.searchParams.get('hostname')).toBe('localhost')
    expect(url.searchParams.get('port')).toBe('9090')
    expect(url.searchParams.get('secret')).toBe('token')
    expect(url.hash).toBe('')
  })

  it('isolates MetaCubeXD from localhost zashboard caches', () => {
    const url = new URL(
      buildExternalUiOpenUrl(
        'localhost:9090',
        'ui',
        'https://github.com/MetaCubeX/metacubexd/archive/refs/heads/gh-pages.zip',
        ''
      )
    )

    expect(url.hostname).toBe('127.0.0.1')
    expect(url.searchParams.get('hostname')).toBe('127.0.0.1')
    expect(url.hash).toBe('')
  })

  it('keeps zashboard connection params in the setup hash route', () => {
    const url = new URL(
      buildExternalUiOpenUrl(
        '127.0.0.1:9090',
        'ui',
        'https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip',
        'token'
      )
    )

    expect(url.hostname).toBe('127.0.0.1')
    expect(url.pathname).toBe('/ui/')
    expect(url.searchParams.has('hostname')).toBe(false)
    expect(url.hash).toBe('#/setup?hostname=127.0.0.1&port=9090&secret=token')
  })
})
