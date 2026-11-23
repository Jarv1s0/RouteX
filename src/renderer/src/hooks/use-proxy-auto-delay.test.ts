// @vitest-environment jsdom
import { useRef } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { mihomoGroupDelay, mihomoProxyDelay } from '@renderer/utils/mihomo-ipc'
import { useGroupsStore } from '@renderer/store/use-groups-store'
import { useProxyAutoDelay } from './use-proxy-auto-delay'
import { useProxyDelayRunner } from './use-proxy-delay-runner'

vi.mock('@renderer/utils/mihomo-ipc', () => ({
  mihomoProxyDelay: vi.fn(),
  mihomoGroupDelay: vi.fn()
}))
vi.mock('@renderer/utils/logger', () => ({ debugLog: vi.fn(), warnLog: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.resetAllMocks()
  useGroupsStore.setState({ groups: undefined })
})

it.each([true, false])(
  'bounds startup retries and retests other timed-out nodes if DNS recovers (%s)',
  async (recovers) => {
    vi.useFakeTimers()
    const timeout = { delay: 0, time: new Date().toISOString() }
    const group = {
      name: 'Group',
      now: 'Selected',
      all: [
        { name: 'Selected', history: [timeout] },
        { name: 'Other', history: recovers ? [timeout] : [] }
      ]
    } as ControllerMixedGroup
    useGroupsStore.setState({ groups: [group] })
    let dnsReady = false
    vi.mocked(mihomoProxyDelay).mockImplementation(async () => {
      if (!dnsReady) throw new Error('DNS lookup timed out')
      return { delay: 42 }
    })
    const mutate = vi.fn()

    renderHook(() => {
      const groups = useGroupsStore((state) => state.groups)
      const groupsRef = useRef(groups ?? [])
      groupsRef.current = groups ?? []
      const delayTestConcurrencyRef = useRef(4)
      const { runDelayTargets } = useProxyDelayRunner({ mutate, delayTestConcurrency: 4 })
      useProxyAutoDelay({
        groupsRef,
        autoDelayGroupSignature: 'Group',
        autoDelayTestOnShow: true,
        delayTestConcurrencyRef,
        runDelayTargets
      })
    })

    await act(async () => {})
    expect(mihomoProxyDelay).toHaveBeenCalledExactlyOnceWith('Selected', undefined)

    dnsReady = recovers
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(mihomoProxyDelay).toHaveBeenCalledTimes(2)
    expect(mihomoProxyDelay).toHaveBeenLastCalledWith('Selected', undefined)
    if (!recovers) {
      await act(async () => vi.advanceTimersByTimeAsync(60000))
      expect(mihomoProxyDelay).toHaveBeenCalledTimes(3)
      expect(vi.mocked(mihomoProxyDelay).mock.calls.every(([name]) => name === 'Selected')).toBe(
        true
      )
      return
    }

    const selected = useGroupsStore.getState().groups?.[0].all[0]
    expect(selected?.history.at(-1)?.delay).toBe(42)

    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(mihomoProxyDelay).toHaveBeenCalledTimes(3)
    expect(mihomoProxyDelay).toHaveBeenLastCalledWith('Other', undefined)
  }
)

it('refreshes groups immediately when a manual group delay request fails', async () => {
  const group = { name: 'Group' } as ControllerMixedGroup
  const mutate = vi.fn()
  vi.mocked(mihomoGroupDelay).mockRejectedValue(new Error('Gateway Timeout'))
  const { result } = renderHook(() => useProxyDelayRunner({ mutate, delayTestConcurrency: 4 }))

  await act(async () => result.current.onGroupDelay(group))
  expect(mutate).toHaveBeenCalledExactlyOnceWith(true)
  expect(result.current.delaying.Group).toBeFalsy()
})
