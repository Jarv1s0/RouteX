import { expect, it, vi } from 'vitest'
import { invokeWithTauriFallback } from './file-ipc'

it('catches async rejections when Tauri fallback is enabled', async () => {
  const fallback = vi.fn(async () => ['fallback-path'])
  const result = await invokeWithTauriFallback(
    () => Promise.reject(new Error('native dialog failed')),
    fallback,
    true
  )

  expect(fallback).toHaveBeenCalledOnce()
  expect(result).toEqual(['fallback-path'])
})

it('propagates rejections when Tauri fallback is disabled', async () => {
  const fallback = vi.fn(() => ['fallback-path'])

  await expect(
    invokeWithTauriFallback(
      () => Promise.reject(new Error('ipc failed')),
      fallback,
      false
    )
  ).rejects.toThrow('ipc failed')
  expect(fallback).not.toHaveBeenCalled()
})
