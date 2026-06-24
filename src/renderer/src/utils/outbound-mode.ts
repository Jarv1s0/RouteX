import { mihomoCloseAllConnections, patchMihomoConfig } from './mihomo-ipc'

interface ApplyOutboundModeChangeOptions {
  currentMode: OutboundMode
  nextMode: OutboundMode
  autoCloseConnection: boolean
  persistMode: (mode: OutboundMode) => Promise<boolean>
}

export async function applyOutboundModeChange(
  options: ApplyOutboundModeChangeOptions
): Promise<boolean> {
  const { currentMode, nextMode, autoCloseConnection, persistMode } = options

  const persisted = await persistMode(nextMode)
  if (!persisted) {
    return false
  }

  try {
    await patchMihomoConfig({ mode: nextMode })
  } catch (error) {
    await persistMode(currentMode).catch(() => false)
    throw error
  }

  if (autoCloseConnection) {
    await mihomoCloseAllConnections()
  }

  return true
}
