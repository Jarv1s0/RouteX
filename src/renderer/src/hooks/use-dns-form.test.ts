// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDnsSettingsEditor } from './use-dns-form'

const mocks = vi.hoisted(() => ({
  app: {} as Partial<AppConfig>,
  core: {} as Partial<MihomoConfig>,
  apply: vi.fn<() => Promise<void>>(),
  notify: vi.fn()
}))
vi.mock('@renderer/hooks/use-app-config', () => ({
  useAppConfig: () => ({ appConfig: mocks.app })
}))
vi.mock('@renderer/hooks/use-controled-mihomo-config', () => ({
  useControledMihomoConfig: () => ({ controledMihomoConfig: mocks.core })
}))
vi.mock('@renderer/utils/core-restart', () => ({ applyConfigChange: mocks.apply }))
vi.mock('@renderer/utils/notify', () => ({ notifyError: mocks.notify }))
vi.mock('@renderer/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
  translate: (key: string) => key
}))

beforeEach(() => {
  mocks.app = { controlDns: true }
  mocks.core = { dns: { listen: '127.0.0.1:53' } }
  mocks.apply.mockReset().mockResolvedValue(undefined)
  mocks.notify.mockClear()
})
afterEach(cleanup)

describe('DNS editor', () => {
  it('refreshes pristine values but preserves an unsaved draft across background updates', async () => {
    const { result, rerender } = renderHook(useDnsSettingsEditor)
    mocks.core = { dns: { listen: '127.0.0.1:1053' } }
    rerender()
    expect(result.current.values.listen).toBe('127.0.0.1:1053')
    act(() => result.current.setValues({ ...result.current.values, listen: '127.0.0.1:2053' }))
    await waitFor(() => expect(result.current.changed).toBe(true))
    mocks.core = { dns: { listen: '127.0.0.1:3053' } }
    rerender()
    expect(result.current.values.listen).toBe('127.0.0.1:2053')
  })

  it('blocks invalid advanced DNS values even without a child error callback', async () => {
    const { result } = renderHook(useDnsSettingsEditor)
    act(() =>
      result.current.setValues({ ...result.current.values, directNameserver: ['not a DNS server'] })
    )
    expect(result.current.saveDisabled).toBe(true)
    await act(() => result.current.save())
    expect(mocks.apply).not.toHaveBeenCalled()
  })

  it('preserves the draft after failure and prevents duplicate submissions', async () => {
    let reject!: (reason: Error) => void
    mocks.apply.mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail
        })
    )
    const { result } = renderHook(useDnsSettingsEditor)
    act(() => result.current.setValues({ ...result.current.values, listen: '127.0.0.1:2053' }))
    let request!: Promise<void>
    act(() => {
      request = result.current.save()
    })
    await waitFor(() => expect(mocks.apply).toHaveBeenCalledTimes(1))
    expect(result.current.saving).toBe(true)
    await act(() => result.current.save())
    await act(async () => {
      reject(new Error('disk full'))
      await request
    })
    expect(mocks.apply).toHaveBeenCalledTimes(1)
    expect(result.current.values.listen).toBe('127.0.0.1:2053')
    expect(result.current.changed).toBe(true)
    expect(result.current.saving).toBe(false)
    expect(mocks.notify).toHaveBeenCalledTimes(1)
    await act(() => result.current.save())
    expect(result.current.changed).toBe(false)
  })

  it('saves both stores together and explicitly deletes removed map keys', async () => {
    mocks.core = { dns: { 'nameserver-policy': { 'old.example': '1.1.1.1' } } }
    const { result } = renderHook(useDnsSettingsEditor)
    act(() =>
      result.current.setValues({
        ...result.current.values,
        nameserverPolicy: { 'new.example': '8.8.8.8' }
      })
    )
    await act(() => result.current.save())
    expect(mocks.apply).toHaveBeenCalledWith(
      expect.objectContaining({
        app: expect.objectContaining({ controlDns: true }),
        core: expect.objectContaining({
          dns: expect.objectContaining({
            'nameserver-policy': { 'old.example': null, 'new.example': '8.8.8.8' }
          })
        })
      })
    )
    expect(result.current.changed).toBe(false)
  })

  it('allows disabling DNS control while retaining invalid inactive draft fields', async () => {
    const { result } = renderHook(useDnsSettingsEditor)
    act(() =>
      result.current.setValues({ ...result.current.values, controlDns: false, listen: 'invalid' })
    )
    await act(() => result.current.save())
    expect(mocks.apply).toHaveBeenCalledWith({ app: { controlDns: false }, core: {} })
  })
})
