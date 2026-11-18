type MihomoCore = 'mihomo' | 'mihomo-alpha' | 'system'
type BundledCore = Exclude<MihomoCore, 'system'>

interface CoreSwitchActions {
  ensureAvailable: (core: BundledCore, refresh: boolean) => Promise<unknown>
  saveCore: (core: MihomoCore) => Promise<void>
  restart: () => Promise<void>
}

export async function switchMihomoCore(
  previousCore: MihomoCore,
  nextCore: BundledCore,
  actions: CoreSwitchActions
): Promise<void> {
  if (previousCore === nextCore) return

  // Keep the running core and saved selection intact until the binary is available.
  await actions.ensureAvailable(nextCore, nextCore === 'mihomo-alpha')
  await actions.saveCore(nextCore)
  try {
    await actions.restart()
  } catch (error) {
    try {
      await actions.saveCore(previousCore)
      await actions.restart()
    } catch (recoveryError) {
      throw new AggregateError([error, recoveryError], `${String(error)}\n${String(recoveryError)}`)
    }
    throw error
  }
}
