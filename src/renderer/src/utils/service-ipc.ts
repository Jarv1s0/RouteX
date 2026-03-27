import { C, invokeSafe } from './ipc-core'

export async function manualGrantCorePermition(
  cores?: ('mihomo' | 'mihomo-alpha')[]
): Promise<void> {
  return invokeSafe(C.manualGrantCorePermition, cores)
}

export async function checkCorePermission(): Promise<{
  mihomo: boolean
  'mihomo-alpha': boolean
}> {
  return invokeSafe(C.checkCorePermission)
}

export async function checkElevateTask(): Promise<boolean> {
  return invokeSafe(C.checkElevateTask)
}

export async function deleteElevateTask(): Promise<void> {
  return invokeSafe(C.deleteElevateTask)
}

export async function revokeCorePermission(cores?: ('mihomo' | 'mihomo-alpha')[]): Promise<void> {
  return invokeSafe(C.revokeCorePermission, cores)
}

export async function serviceStatus(): Promise<
  'running' | 'stopped' | 'not-installed' | 'unknown'
> {
  return invokeSafe(C.serviceStatus)
}

export async function testServiceConnection(): Promise<boolean> {
  return invokeSafe(C.testServiceConnection)
}

export async function initService(): Promise<void> {
  return invokeSafe(C.initService)
}

export async function installService(): Promise<void> {
  return invokeSafe(C.installService)
}

export async function uninstallService(): Promise<void> {
  return invokeSafe(C.uninstallService)
}

export async function startService(): Promise<void> {
  return invokeSafe(C.startService)
}

export async function restartService(): Promise<void> {
  return invokeSafe(C.restartService)
}

export async function stopService(): Promise<void> {
  return invokeSafe(C.stopService)
}

export async function findSystemMihomo(): Promise<string[]> {
  return invokeSafe(C.findSystemMihomo)
}
