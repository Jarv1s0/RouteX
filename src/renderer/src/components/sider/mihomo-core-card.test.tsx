// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MihomoCoreCard from './mihomo-core-card'

const mocks = vi.hoisted(() => ({
  mihomoVersion: vi.fn(),
  retainTauriMemoryBridge: vi.fn(),
  releaseMemoryBridge: vi.fn(),
  offMemory: vi.fn(),
  offCoreStarted: vi.fn(),
  offCoreChanged: vi.fn()
}))

vi.mock('@heroui/react', () => ({
  Button: ({
    children,
    onPress,
    isIconOnly: _isIconOnly,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    onPress?: () => void
    isIconOnly?: boolean
  }) => (
    <button type="button" onClick={onPress} {...props}>
      {children}
    </button>
  ),
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/proxies' })
}))

vi.mock('@renderer/routes', () => ({
  navigateSidebarRoute: vi.fn(),
  preloadSidebarRoute: vi.fn()
}))

vi.mock('@renderer/hooks/use-app-config', () => ({
  useAppConfig: () => ({ appConfig: { core: 'mihomo' } })
}))

vi.mock('@renderer/hooks/use-mihomo-latest-version', () => ({
  useMihomoLatestVersion: () => undefined
}))

vi.mock('@renderer/utils/mihomo-version', () => ({
  hasMihomoUpdate: () => false
}))

vi.mock('@renderer/utils/mihomo-core-events', () => ({
  onMihomoCoreChanged: () => mocks.offCoreChanged
}))

vi.mock('@renderer/utils/ipc-channels', () => ({
  ON: { mihomoMemory: 'mihomoMemory', coreStarted: 'coreStarted' },
  onIpc: (channel: string) =>
    channel === 'mihomoMemory' ? mocks.offMemory : mocks.offCoreStarted
}))

vi.mock('@renderer/utils/mihomo-ipc', () => ({
  mihomoVersion: mocks.mihomoVersion,
  restartCore: vi.fn(),
  isExpectedMihomoUnavailableError: () => false,
  retainTauriMemoryBridge: mocks.retainTauriMemoryBridge
}))

vi.mock('@renderer/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

describe('MihomoCoreCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.retainTauriMemoryBridge.mockReturnValue(mocks.releaseMemoryBridge)
    mocks.mihomoVersion.mockResolvedValue({ version: 'v1.19.33' })
  })

  afterEach(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    cleanup()
  })

  it('does not tear down memory bridge or IPC listeners when version updates and skips visibility refetch', async () => {
    render(<MihomoCoreCard compact />)

    await act(async () => {
      await Promise.resolve()
    })

    expect(mocks.mihomoVersion).toHaveBeenCalledTimes(1)
    expect(mocks.retainTauriMemoryBridge).toHaveBeenCalledTimes(1)
    expect(mocks.releaseMemoryBridge).not.toHaveBeenCalled()

    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(mocks.mihomoVersion).toHaveBeenCalledTimes(1)
    expect(mocks.retainTauriMemoryBridge).toHaveBeenCalledTimes(1)
  })
})
