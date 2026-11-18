import { beforeEach, expect, it, vi } from 'vitest'
import { applyConfigChange } from './core-restart'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  getApp: vi.fn(),
  getCore: vi.fn(),
  sync: vi.fn(),
  setApp: vi.fn(),
  mutate: vi.fn()
}))
vi.mock('./ipc-core', () => ({ C: { applyConfig: 'applyConfig' }, invokeTyped: mocks.invoke }))
vi.mock('@renderer/api/app', () => ({ getAppConfig: mocks.getApp }))
vi.mock('./mihomo-ipc', () => ({
  getControledMihomoConfig: mocks.getCore,
  syncAppliedCoreConfig: mocks.sync,
  isExpectedMihomoUnavailableError: vi.fn(),
  reloadCoreConfig: vi.fn(),
  restartCore: vi.fn()
}))
vi.mock('@renderer/store/use-app-store', () => ({
  useAppStore: { getState: () => ({ setAppConfig: mocks.setApp }) }
}))
vi.mock('swr', () => ({ mutate: mocks.mutate }))
vi.mock('./notify', () => ({ notifyError: vi.fn() }))
vi.mock('@renderer/i18n', () => ({ translate: (key: string) => key }))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getApp.mockResolvedValue({ controlDns: true })
  mocks.getCore.mockResolvedValue({ dns: {} })
  mocks.mutate.mockImplementation(async (_key, data) => await data)
})

it('sends both patches in one request and updates the controller only after success', async () => {
  mocks.invoke.mockResolvedValueOnce({ controller: '127.0.0.1:9090' })
  const change = { app: { controlDns: true }, core: { dns: { ipv6: true } } }
  await applyConfigChange(change)
  expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('applyConfig', change)
  expect(mocks.sync).toHaveBeenCalledExactlyOnceWith({ controller: '127.0.0.1:9090' })
  expect(mocks.getApp).toHaveBeenCalledWith(true)
  expect(mocks.getCore).toHaveBeenCalledWith(true)
  expect(mocks.setApp).toHaveBeenCalledWith({ controlDns: true })
})

it('reconciles rolled-back config and preserves the original error if refresh also fails', async () => {
  mocks.invoke.mockRejectedValueOnce(new Error('apply failed'))
  mocks.getApp.mockRejectedValueOnce(new Error('refresh failed'))
  await expect(applyConfigChange({ core: { ipv6: true } })).rejects.toThrow('apply failed')
  expect(mocks.sync).not.toHaveBeenCalled()
  expect(mocks.getCore).toHaveBeenCalledWith(true)
})
