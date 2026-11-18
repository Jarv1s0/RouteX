import { beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from './use-app-store'

const mocks = vi.hoisted(() => ({ patch: vi.fn(), get: vi.fn() }))
vi.mock('@renderer/api/app', () => ({ patchAppConfig: mocks.patch, getAppConfig: mocks.get }))

beforeEach(() => {
  vi.clearAllMocks()
  useAppStore.setState({ appConfig: { language: 'zh-CN' } as AppConfig })
  mocks.get.mockResolvedValue({ language: 'zh-CN' })
})

it('rejects a failed save, retains the saved value and does not execute dependent work', async () => {
  mocks.patch.mockRejectedValueOnce(new Error('write denied'))
  const apply = vi.fn()
  await expect(
    (async () => {
      await useAppStore.getState().patchAppConfig({ language: 'en-US' })
      apply()
    })()
  ).rejects.toThrow('write denied')
  expect(apply).not.toHaveBeenCalled()
  expect(useAppStore.getState().appConfig?.language).toBe('zh-CN')
  expect(mocks.get).toHaveBeenCalledWith(true)
})

it('updates local state only after a successful save', async () => {
  mocks.patch.mockResolvedValueOnce(undefined)
  await useAppStore.getState().patchAppConfig({ language: 'en-US' })
  expect(useAppStore.getState().appConfig?.language).toBe('en-US')
})
