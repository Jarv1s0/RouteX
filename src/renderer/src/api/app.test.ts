import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  invokeSafe: vi.fn(),
  invokeTyped: vi.fn()
}))

vi.mock('@renderer/utils/ipc-core', () => ({
  C: {
    setNativeTheme: 'setNativeTheme',
    getAppConfig: 'getAppConfig',
    patchAppConfig: 'patchAppConfig'
  },
  invokeSafe: mocks.invokeSafe,
  invokeTyped: mocks.invokeTyped
}))

vi.mock('@renderer/api/desktop', () => ({
  emitDesktopEvent: vi.fn()
}))

vi.mock('@renderer/utils/mihomo-ipc', () => ({
  stopTauriMihomoEventBridge: vi.fn()
}))

describe('setNativeTheme deduplication', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('deduplicates repeated calls after success and deduplicates concurrent in-flight calls', async () => {
    let resolvePending!: () => void
    mocks.invokeSafe.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolvePending = resolve
        })
    )

    const { setNativeTheme } = await import('./app')

    const first = setNativeTheme('dark')
    const second = setNativeTheme('dark')
    expect(mocks.invokeSafe).toHaveBeenCalledTimes(1)

    resolvePending()
    await Promise.all([first, second])

    await setNativeTheme('dark')
    expect(mocks.invokeSafe).toHaveBeenCalledTimes(1)

    mocks.invokeSafe.mockResolvedValueOnce(undefined)
    await setNativeTheme('light')
    expect(mocks.invokeSafe).toHaveBeenCalledTimes(2)
    expect(mocks.invokeSafe).toHaveBeenLastCalledWith('setNativeTheme', 'light')
  })

  it('does not cache failed theme switches so subsequent retries run IPC again', async () => {
    mocks.invokeSafe.mockRejectedValueOnce(new Error('ipc failed')).mockResolvedValueOnce(undefined)

    const { setNativeTheme } = await import('./app')

    await expect(setNativeTheme('dark')).rejects.toThrow('ipc failed')
    await setNativeTheme('dark')

    expect(mocks.invokeSafe).toHaveBeenCalledTimes(2)
  })
})
