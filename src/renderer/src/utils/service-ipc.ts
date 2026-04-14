import { C, invokeSafe } from './ipc-core'

function isTauriHost(): boolean {
  return __ROUTEX_HOST__ === 'tauri'
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, Math.min(index + chunkSize, bytes.length))
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

function base64ToPem(base64: string, label: string): string {
  const lines = base64.match(/.{1,64}/g)?.join('\n') ?? base64
  return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----\n`
}

async function generateServiceAuthKey(): Promise<{ publicKey: string; privateKey: string }> {
  const algorithm = { name: 'Ed25519' } as AlgorithmIdentifier
  const keyPair = (await window.crypto.subtle.generateKey(
    algorithm,
    true,
    ['sign', 'verify']
  )) as CryptoKeyPair
  const publicKeyBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey)
  const privateKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
  const publicKey = arrayBufferToBase64(publicKeyBuffer)
  const privateKey = base64ToPem(arrayBufferToBase64(privateKeyBuffer), 'PRIVATE KEY')
  return { publicKey, privateKey }
}

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
  'running' | 'stopped' | 'not-installed' | 'unknown' | 'need-init'
> {
  return invokeSafe(C.serviceStatus)
}

export async function testServiceConnection(): Promise<boolean> {
  return invokeSafe(C.testServiceConnection)
}

export async function initService(): Promise<void> {
  if (isTauriHost()) {
    return invokeSafe(C.initService, await generateServiceAuthKey())
  }

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
