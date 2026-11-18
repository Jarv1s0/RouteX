import { describe, expect, it, vi } from 'vitest'
import { switchMihomoCore } from './mihomo-core-switch'

function createCoreRuntime(initialCore = 'mihomo', alphaCompatible = false) {
  let selected = initialCore
  let running: string | null = initialCore
  const actions = {
    ensureAvailable: vi.fn(async (): Promise<void> => undefined),
    saveCore: vi.fn(async (core: string) => {
      selected = core
    }),
    restart: vi.fn(async () => {
      running = null
      if (selected === 'mihomo-alpha' && !alphaCompatible) throw new Error('invalid tun stack')
      running = selected
    })
  }
  return { actions, snapshot: () => ({ selected, running }) }
}

describe('Mihomo core switching', () => {
  it('restores the saved core and running process when the target fails to start', async () => {
    const runtime = createCoreRuntime()
    await expect(switchMihomoCore('mihomo', 'mihomo-alpha', runtime.actions)).rejects.toThrow(
      'invalid tun stack'
    )
    expect(runtime.snapshot()).toEqual({ selected: 'mihomo', running: 'mihomo' })
    expect(runtime.actions.restart).toHaveBeenCalledTimes(2)
    expect(runtime.actions.ensureAvailable).toHaveBeenCalledWith('mihomo-alpha', true)
  })

  it('keeps the original core untouched when download fails', async () => {
    const runtime = createCoreRuntime()
    runtime.actions.ensureAvailable.mockRejectedValueOnce(new Error('download failed'))
    await expect(switchMihomoCore('mihomo', 'mihomo-alpha', runtime.actions)).rejects.toThrow(
      'download failed'
    )
    expect(runtime.snapshot()).toEqual({ selected: 'mihomo', running: 'mihomo' })
    expect(runtime.actions.saveCore).not.toHaveBeenCalled()
    expect(runtime.actions.restart).not.toHaveBeenCalled()
  })

  it('does not restart when saving the selection fails', async () => {
    const runtime = createCoreRuntime()
    runtime.actions.saveCore.mockRejectedValueOnce(new Error('write failed'))
    await expect(switchMihomoCore('mihomo', 'mihomo-alpha', runtime.actions)).rejects.toThrow(
      'write failed'
    )
    expect(runtime.actions.restart).not.toHaveBeenCalled()
  })

  it('keeps a successfully started target selected', async () => {
    const runtime = createCoreRuntime('mihomo', true)
    await switchMihomoCore('mihomo', 'mihomo-alpha', runtime.actions)
    expect(runtime.snapshot()).toEqual({ selected: 'mihomo-alpha', running: 'mihomo-alpha' })
    expect(runtime.actions.restart).toHaveBeenCalledTimes(1)
  })

  it('switches back to stable without requesting an Alpha download', async () => {
    const runtime = createCoreRuntime('mihomo-alpha', true)
    await switchMihomoCore('mihomo-alpha', 'mihomo', runtime.actions)
    expect(runtime.actions.ensureAvailable).toHaveBeenCalledWith('mihomo', false)
    expect(runtime.snapshot()).toEqual({ selected: 'mihomo', running: 'mihomo' })
  })

  it('keeps the old selection and process while the download is pending', async () => {
    const runtime = createCoreRuntime('mihomo', true)
    let finishDownload!: () => void
    runtime.actions.ensureAvailable.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishDownload = resolve
      })
    )
    const switching = switchMihomoCore('mihomo', 'mihomo-alpha', runtime.actions)
    expect(runtime.snapshot()).toEqual({ selected: 'mihomo', running: 'mihomo' })
    expect(runtime.actions.restart).not.toHaveBeenCalled()
    finishDownload()
    await switching
    expect(runtime.snapshot()).toEqual({ selected: 'mihomo-alpha', running: 'mihomo-alpha' })
  })

  it('reports both the startup and recovery errors', async () => {
    const runtime = createCoreRuntime()
    runtime.actions.restart
      .mockRejectedValueOnce(new Error('start failed'))
      .mockRejectedValueOnce(new Error('recovery failed'))
    await expect(switchMihomoCore('mihomo', 'mihomo-alpha', runtime.actions)).rejects.toMatchObject(
      { message: 'Error: start failed\nError: recovery failed' }
    )
    expect(runtime.snapshot().selected).toBe('mihomo')
  })

  it('does nothing when selecting the current core', async () => {
    const runtime = createCoreRuntime()
    await switchMihomoCore('mihomo', 'mihomo', runtime.actions)
    expect(runtime.actions.ensureAvailable).not.toHaveBeenCalled()
    expect(runtime.actions.restart).not.toHaveBeenCalled()
  })
})
