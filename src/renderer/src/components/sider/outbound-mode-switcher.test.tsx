// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OutboundModeSwitcher from './outbound-mode-switcher'
import { useGroupsStore } from '@renderer/store/use-groups-store'

const mocks = vi.hoisted(() => ({
  patchControledMihomoConfig: vi.fn(),
  applyOutboundModeChange: vi.fn(),
  sendIpc: vi.fn(),
  fetchGroups: vi.fn()
}))

vi.mock('@renderer/hooks/use-app-config', () => ({
  useAppConfig: () => ({ appConfig: { autoCloseConnection: true } })
}))

vi.mock('@renderer/hooks/use-controled-mihomo-config', () => ({
  useControledMihomoConfig: () => ({
    controledMihomoConfig: { mode: 'rule' },
    patchControledMihomoConfig: mocks.patchControledMihomoConfig
  })
}))

vi.mock('@renderer/utils/outbound-mode', () => ({
  applyOutboundModeChange: mocks.applyOutboundModeChange
}))

vi.mock('@renderer/utils/ipc-channels', () => ({
  SEND: { updateTrayMenu: 'updateTrayMenu' },
  sendIpc: mocks.sendIpc
}))

vi.mock('@renderer/utils/notify', () => ({
  notifyError: vi.fn()
}))

vi.mock('@renderer/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

describe('OutboundModeSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.applyOutboundModeChange.mockResolvedValue(true)
    mocks.fetchGroups.mockResolvedValue(undefined)
    useGroupsStore.setState({
      groups: [],
      fetchGroups: mocks.fetchGroups
    })
  })

  afterEach(cleanup)

  it('does not subscribe to groups store updates and calls store fetchGroups on mode change', async () => {
    let renderCount = 0
    const SpyWrapper = (): React.JSX.Element => {
      renderCount += 1
      return <OutboundModeSwitcher />
    }

    render(<SpyWrapper />)
    expect(renderCount).toBe(1)

    await act(async () => {
      useGroupsStore.setState({
        groups: [
          { name: 'Proxy', type: 'Selector', now: 'NodeA', all: [] }
        ] as unknown as ControllerMixedGroup[]
      })
    })
    expect(renderCount).toBe(1)

    await act(async () => {
      fireEvent.click(screen.getByText('outbound.global'))
    })

    expect(mocks.applyOutboundModeChange).toHaveBeenCalledTimes(1)
    expect(mocks.fetchGroups).toHaveBeenCalledTimes(1)
    expect(mocks.sendIpc).toHaveBeenCalledWith('updateTrayMenu')
  })

  it('renders compact dropdown in headerMode and switches outbound mode on selection', async () => {
    render(<OutboundModeSwitcher headerMode />)

    const trigger = screen.getByRole('button', { name: /outbound\.rule/i })
    await act(async () => {
      fireEvent.click(trigger)
    })

    const globalOption = await screen.findByText('outbound.global')
    await act(async () => {
      fireEvent.click(globalOption)
    })

    expect(mocks.applyOutboundModeChange).toHaveBeenCalledWith(
      expect.objectContaining({
        currentMode: 'rule',
        nextMode: 'global'
      })
    )
    expect(mocks.fetchGroups).toHaveBeenCalledTimes(1)
    expect(mocks.sendIpc).toHaveBeenCalledWith('updateTrayMenu')
  })
})
