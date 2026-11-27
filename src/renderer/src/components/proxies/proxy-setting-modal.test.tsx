// @vitest-environment jsdom
import React from 'react'
import { HeroUIProvider } from '@heroui/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ProxySettingModal from './proxy-setting-modal'

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
)

const mocks = vi.hoisted(() => ({
  patchAppConfig: vi.fn().mockResolvedValue(undefined),
  appConfig: {
    collapseSidebar: false,
    siderWidth: 220,
    proxyCols: 'auto' as const,
    proxyDisplayOrder: 'default' as const,
    autoCloseConnection: true,
    autoDelayTestOnShow: true,
    delayTestUrl: 'https://www.apple.com/library/test/success.html',
    delayTestConcurrency: 4,
    delayTestTimeout: 10000,
    delayThresholds: { good: 250, fair: 500 },
    groupOrder: ['Proxy', 'AI']
  }
}))

vi.mock('@renderer/i18n', () => ({
  useI18n: () => ({
    t: (key: string, values?: Record<string, string | number>) =>
      values ? `${key}:${JSON.stringify(values)}` : key
  })
}))

vi.mock('@renderer/utils/init', () => ({ platform: 'win32', version: '4.6.0' }))
vi.mock('@renderer/utils/notify', () => ({ notifyError: vi.fn() }))
vi.mock('@renderer/hooks/use-app-config', () => ({
  useAppConfig: () => ({
    appConfig: mocks.appConfig,
    patchAppConfig: mocks.patchAppConfig
  })
}))
vi.mock('@renderer/hooks/use-groups', () => ({
  useGroups: () => ({
    groups: [
      { name: 'GLOBAL', all: [] },
      { name: 'Proxy', all: [{ name: 'HK-01' }] },
      { name: 'AI', all: [{ name: 'US-01' }, { name: 'JP-01' }] }
    ]
  })
}))
vi.mock('./proxy-chain-modal', () => ({ default: () => null }))

function renderModal(): void {
  render(
    <HeroUIProvider>
      <ProxySettingModal onClose={vi.fn()} />
    </HeroUIProvider>
  )
}

describe('ProxySettingModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.patchAppConfig.mockResolvedValue(undefined)
  })

  afterEach(cleanup)

  it('renders grouped sections and commits numeric inputs on blur without mid-edit jumping', () => {
    renderModal()

    expect(screen.getByText('proxies.section.view')).toBeTruthy()
    expect(screen.getByText('proxies.section.behavior')).toBeTruthy()
    expect(screen.getByText('proxies.section.delayTest')).toBeTruthy()

    const timeoutInput = screen.getByLabelText('proxies.delayTestTimeout') as HTMLInputElement
    expect(timeoutInput.value).toBe('10000')

    // Clearing the value mid-edit must not immediately overwrite config or jump back
    fireEvent.change(timeoutInput, { target: { value: '' } })
    expect(timeoutInput.value).toBe('')
    expect(mocks.patchAppConfig).not.toHaveBeenCalled()

    // Values above the supported range clamp to 15000 on blur
    fireEvent.change(timeoutInput, { target: { value: '20000' } })
    fireEvent.blur(timeoutInput)
    expect(timeoutInput.value).toBe('15000')
    expect(mocks.patchAppConfig).toHaveBeenCalledWith({ delayTestTimeout: 15000 })
  })

  it('steps concurrency and syncs linked delay thresholds on blur', () => {
    renderModal()

    fireEvent.click(screen.getByRole('button', { name: 'proxies.concurrencyIncrease' }))
    expect(mocks.patchAppConfig).toHaveBeenCalledWith({ delayTestConcurrency: 5 })

    const goodInput = screen.getByLabelText('proxies.delayExcellent') as HTMLInputElement
    const fairInput = screen.getByLabelText('proxies.delayGood') as HTMLInputElement

    fireEvent.change(goodInput, { target: { value: '600' } })
    fireEvent.blur(goodInput)

    expect(goodInput.value).toBe('600')
    expect(fairInput.value).toBe('601')
    expect(mocks.patchAppConfig).toHaveBeenCalledWith({
      delayThresholds: { good: 600, fair: 601 }
    })
  })

  it('resets delay test URL and group order cleanly, and opens group sort modal', () => {
    renderModal()

    fireEvent.click(screen.getByRole('button', { name: 'proxies.resetToDefault' }))
    expect(mocks.patchAppConfig).toHaveBeenCalledWith({ delayTestUrl: '' })

    fireEvent.click(screen.getByRole('button', { name: 'common.reset' }))
    expect(mocks.patchAppConfig).toHaveBeenCalledWith({ groupOrder: [] })

    fireEvent.click(screen.getByRole('button', { name: 'proxies.adjustOrder' }))
    expect(screen.getByText('proxies.adjustGroupOrder')).toBeTruthy()
    expect(screen.getByText('Proxy')).toBeTruthy()
    expect(screen.getByText('AI')).toBeTruthy()
    expect(screen.queryByText('GLOBAL')).toBeNull()
  })
})
