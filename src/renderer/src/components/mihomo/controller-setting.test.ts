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
  it('puts MetaCubeXD connection params in the real query string', () => {
    const url = new URL(
      buildExternalUiOpenUrl(
        '127.0.0.1:9090',
        'ui/metacubexd-gh-pages',
        'https://github.com/MetaCubeX/metacubexd/archive/refs/heads/gh-pages.zip',
        'token'
      )
    )

    expect(url.pathname).toBe('/ui/')
    expect(url.searchParams.get('_routex_ui')).toBe('metacubexd')
    expect(url.searchParams.get('hostname')).toBe('127.0.0.1')
    expect(url.searchParams.get('port')).toBe('9090')
    expect(url.searchParams.get('secret')).toBe('token')
    expect(url.hash).toBe('#/setup')
  })

  it('keeps zashboard connection params in the setup hash route', () => {
    const url = new URL(
      buildExternalUiOpenUrl(
        '127.0.0.1:9090',
        'ui/zashboard',
        'https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip',
        'token'
      )
    )

    expect(url.pathname).toBe('/ui/')
    expect(url.searchParams.get('_routex_ui')).toBe('zashboard')
    expect(url.searchParams.has('hostname')).toBe(false)
    expect(url.hash).toBe('#/setup?hostname=127.0.0.1&port=9090&secret=token')
  })
})
