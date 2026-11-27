// @vitest-environment jsdom
import React from 'react'
import { HeroUIProvider } from '@heroui/react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ConnectionSettingModal from './connection-setting-modal'
import { DEFAULT_COLUMNS } from './columns'

const mocks = vi.hoisted(() => ({
  patchAppConfig: vi.fn().mockResolvedValue(undefined),
  restartMihomoConnections: vi.fn().mockResolvedValue(undefined),
  appConfig: {
    collapseSidebar: false,
    siderWidth: 220,
    displayIcon: true,
    displayAppName: true,
    connectionInterval: 500,
    connectionTableColumns: ['process', 'host']
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
vi.mock('@renderer/utils/mihomo-ipc', () => ({
  restartMihomoConnections: mocks.restartMihomoConnections
}))
vi.mock('@renderer/hooks/use-app-config', () => ({
  useAppConfig: () => ({
    appConfig: mocks.appConfig,
    patchAppConfig: mocks.patchAppConfig
  })
}))

function renderModal(): void {
  render(
    <HeroUIProvider>
      <ConnectionSettingModal onClose={vi.fn()} />
    </HeroUIProvider>
  )
}

describe('ConnectionSettingModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.patchAppConfig.mockResolvedValue(undefined)
    mocks.restartMihomoConnections.mockResolvedValue(undefined)
    mocks.appConfig.connectionInterval = 500
    mocks.appConfig.connectionTableColumns = ['process', 'host']
  })

  afterEach(cleanup)

  it('commits refresh interval on blur, clamps below 500 without spurious restarts, and restarts on real changes', async () => {
    renderModal()

    const intervalInput = screen.getByLabelText('connections.refreshInterval') as HTMLInputElement
    expect(intervalInput.value).toBe('500')

    // Clearing mid-edit must not commit immediately
    fireEvent.change(intervalInput, { target: { value: '' } })
    expect(intervalInput.value).toBe('')
    expect(mocks.patchAppConfig).not.toHaveBeenCalled()

    // Values below 500 clamp back to 500 and skip unnecessary restart when unchanged
    fireEvent.change(intervalInput, { target: { value: '200' } })
    fireEvent.blur(intervalInput)
    expect(intervalInput.value).toBe('500')
    expect(mocks.patchAppConfig).not.toHaveBeenCalled()
    expect(mocks.restartMihomoConnections).not.toHaveBeenCalled()

    // Valid new value updates config and restarts connection stream
    fireEvent.change(intervalInput, { target: { value: '1200' } })
    fireEvent.blur(intervalInput)
    await waitFor(() => {
      expect(mocks.patchAppConfig).toHaveBeenCalledWith({ connectionInterval: 1200 })
      expect(mocks.restartMihomoConnections).toHaveBeenCalledTimes(1)
    })
  })

  it('saves a return to the original interval after an in-flight change', async () => {
    let finishSave!: () => void
    mocks.patchAppConfig.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishSave = resolve
      })
    )
    renderModal()

    const input = screen.getByLabelText('connections.refreshInterval')
    fireEvent.change(input, { target: { value: '1200' } })
    fireEvent.blur(input)
    expect(mocks.patchAppConfig).toHaveBeenCalledWith({ connectionInterval: 1200 })

    fireEvent.change(input, { target: { value: '500' } })
    fireEvent.blur(input)
    expect(mocks.patchAppConfig).toHaveBeenCalledTimes(1)

    finishSave()
    await waitFor(() => {
      expect(mocks.patchAppConfig).toHaveBeenNthCalledWith(2, { connectionInterval: 500 })
      expect(mocks.restartMihomoConnections).toHaveBeenCalledTimes(2)
    })
  })

  it('toggles column visibility and resets custom table columns to defaults', () => {
    renderModal()

    const ruleColumnButton = screen.getByRole('button', { name: 'connections.column.rule' })
    expect(ruleColumnButton.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(screen.getByText('connections.column.rule'))
    expect(mocks.patchAppConfig).toHaveBeenCalledWith({
      connectionTableColumns: ['process', 'host', 'rule']
    })

    fireEvent.click(screen.getByRole('button', { name: 'common.reset' }))
    expect(mocks.patchAppConfig).toHaveBeenCalledWith({
      connectionTableColumns: DEFAULT_COLUMNS
    })
  })
})
