import { C, invokeSafe } from './ipc-core'

export async function checkAutoRun(): Promise<boolean> {
  return invokeSafe(C.checkAutoRun)
}

export async function enableAutoRun(): Promise<void> {
  return invokeSafe(C.enableAutoRun)
}

export async function disableAutoRun(): Promise<void> {
  return invokeSafe(C.disableAutoRun)
}

export async function getAppConfig(force = false): Promise<AppConfig> {
  return invokeSafe(C.getAppConfig, force)
}

export async function patchAppConfig(patch: Partial<AppConfig>): Promise<void> {
  return invokeSafe(C.patchAppConfig, patch)
}

export async function checkUpdate(): Promise<AppVersion | undefined> {
  return invokeSafe(C.checkUpdate)
}

export async function downloadAndInstallUpdate(version: string): Promise<void> {
  return invokeSafe(C.downloadAndInstallUpdate, version)
}

export async function cancelUpdate(): Promise<void> {
  return invokeSafe(C.cancelUpdate)
}

export async function getVersion(): Promise<string> {
  return invokeSafe(C.getVersion)
}

export async function getPlatform(): Promise<NodeJS.Platform> {
  return invokeSafe(C.platform)
}

export async function relaunchApp(): Promise<void> {
  return invokeSafe(C.relaunchApp)
}

export async function quitWithoutCore(): Promise<void> {
  return invokeSafe(C.quitWithoutCore)
}

export async function quitApp(): Promise<void> {
  return invokeSafe(C.quitApp)
}

export async function notDialogQuit(): Promise<void> {
  return invokeSafe(C.notDialogQuit)
}

export async function openDevTools(): Promise<void> {
  return invokeSafe(C.openDevTools)
}

export async function resetAppConfig(): Promise<void> {
  return invokeSafe(C.resetAppConfig)
}

export async function createHeapSnapshot(): Promise<void> {
  return invokeSafe(C.createHeapSnapshot)
}

export async function setNativeTheme(theme: 'system' | 'light' | 'dark'): Promise<void> {
  return invokeSafe(C.setNativeTheme, theme)
}

export async function openUWPTool(): Promise<void> {
  return invokeSafe(C.openUWPTool)
}

export async function getUserAgent(): Promise<string> {
  return invokeSafe(C.getUserAgent)
}

export async function registerShortcut(
  oldShortcut: string,
  newShortcut: string,
  action: string
): Promise<boolean> {
  return invokeSafe(C.registerShortcut, oldShortcut, newShortcut, action)
}

export async function copyEnv(type: 'bash' | 'cmd' | 'powershell' | 'nushell'): Promise<void> {
  return invokeSafe(C.copyEnv, type)
}
