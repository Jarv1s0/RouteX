import { expect, expectTypeOf, it, vi } from 'vitest'
import { C, invokeTyped } from './ipc-core'

const invoke = vi.hoisted(() => vi.fn())
vi.mock('@renderer/api/desktop', () => ({ desktop: { invoke } }))
vi.mock('@renderer/i18n', () => ({ translate: (key: string) => key }))

it('infers configuration results from the channel and preserves error handling', async () => {
  invoke.mockResolvedValueOnce({ language: 'zh-CN' })
  const config = await invokeTyped(C.getAppConfig, true)
  expectTypeOf(config).toEqualTypeOf<Partial<AppConfig>>()
  expect(config.language).toBe('zh-CN')
  expect(invoke).toHaveBeenCalledWith('getAppConfig', true)
  invoke.mockResolvedValueOnce({ invokeError: 'write failed' })
  await expect(invokeTyped(C.patchAppConfig, { language: 'en-US' })).rejects.toBe('write failed')
})

it('rejects invalid channel arguments during typechecking', () => {
  const invalidCalls = () => {
    // @ts-expect-error a connection ID is required
    invokeTyped(C.mihomoCloseConnection)
    // @ts-expect-error force is a boolean
    invokeTyped(C.getAppConfig, 'force')
    // @ts-expect-error getTrafficStats accepts no arguments
    invokeTyped(C.getTrafficStats, {})
    // @ts-expect-error configuration patches must match AppConfig
    invokeTyped(C.patchAppConfig, { language: 42 })
  }
  expect(invalidCalls).toBeTypeOf('function')
})
