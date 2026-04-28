import { execFile } from 'child_process'
import { promisify } from 'util'
import { servicePath } from '../utils/dirs'
import { execWithElevation } from '../utils/elevation'
import { initServiceAPI, getServiceAxios, ping, test, ServiceAPIError } from './api'
import {
  canPersistServiceAuthSecret,
  loadServiceAuthSecret,
  saveServiceAuthSecret,
  type ServiceAuthSecret
} from './auth-store'
import { KeyManager, type KeyPair } from './key'

let keyManager: KeyManager | null = null
const execFilePromise = promisify(execFile)

async function ensureServiceAPIReady(): Promise<void> {
  if (keyManager) {
    return
  }

  await initKeyManager()
}

async function loadAvailableServiceAuth(): Promise<ServiceAuthSecret | null> {
  try {
    return await loadServiceAuthSecret()
  } catch {
    return null
  }
}

function applyServiceAuthSecret(target: KeyManager, secret: ServiceAuthSecret | null): void {
  target.clear()
  if (secret) {
    target.setKeyPair(secret.publicKey, secret.privateKey, secret.keyId)
  }
}

function currentServiceAuthSecret(target: KeyManager): ServiceAuthSecret {
  return {
    keyId: target.getKeyID(),
    publicKey: target.getPublicKey(),
    privateKey: target.getPrivateKey()
  }
}

async function ensurePersistedServiceAuth(target: KeyManager): Promise<ServiceAuthSecret> {
  if (target.isInitialized()) {
    return currentServiceAuthSecret(target)
  }

  const existingSecret = await loadAvailableServiceAuth()
  if (existingSecret) {
    applyServiceAuthSecret(target, existingSecret)
    return existingSecret
  }

  if (!canPersistServiceAuthSecret()) {
    throw new Error('当前系统安全存储不可用，无法初始化服务鉴权')
  }

  const generatedKeyPair: KeyPair = target.generateKeyPair()
  await saveServiceAuthSecret(generatedKeyPair)
  return generatedKeyPair
}

export async function initKeyManager(): Promise<KeyManager> {
  if (keyManager) {
    return keyManager
  }

  keyManager = new KeyManager()
  const existingSecret = await loadAvailableServiceAuth()
  applyServiceAuthSecret(keyManager, existingSecret)
  initServiceAPI(keyManager)
  return keyManager
}

export function getKeyManager(): KeyManager {
  if (!keyManager) {
    throw new Error('密钥管理器未初始化，请先调用 initKeyManager')
  }
  return keyManager
}

export function getPublicKey(): string {
  return getKeyManager().getPublicKey()
}

class UserCancelledError extends Error {
  constructor(message = '用户取消操作') {
    super(message)
    this.name = 'UserCancelledError'
  }
}

function isUserCancelledError(error: unknown): boolean {
  if (error instanceof UserCancelledError) {
    return true
  }
  const errorMsg = error instanceof Error ? error.message : String(error)
  return (
    errorMsg.includes('用户已取消') ||
    errorMsg.includes('User canceled') ||
    errorMsg.includes('(-128)') ||
    errorMsg.includes('user cancelled') ||
    errorMsg.includes('dismissed')
  )
}

async function runElevatedServiceCommand(command: string, failurePrefix: string): Promise<void> {
  try {
    await execWithElevation(servicePath(), ['service', command])
  } catch (error) {
    if (isUserCancelledError(error)) {
      throw new UserCancelledError()
    }
    throw new Error(`${failurePrefix}：${error instanceof Error ? error.message : String(error)}`)
  }
}

async function getAuthorizedPrincipalArgs(): Promise<string[]> {
  if (process.platform === 'win32') {
    const { stdout } = await execFilePromise(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        '[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value'
      ],
      { timeout: 5000 }
    )

    const sid = stdout.trim()
    if (!sid.startsWith('S-')) {
      throw new Error('读取当前用户 SID 失败')
    }

    return ['--authorized-sid', sid]
  }

  const uid = process.getuid?.()
  if (uid == null) {
    throw new Error('读取当前用户 UID 失败')
  }

  return ['--authorized-uid', String(uid)]
}

export function exportPublicKey(): string {
  return getPublicKey()
}

export function getAxios() {
  return getServiceAxios()
}

async function waitForServiceReady(timeoutMs = 15000): Promise<void> {
  const startedAt = Date.now()
  let lastError: unknown = null

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await ping()
      await test()
      return
    } catch (error) {
      lastError = error
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(
    `等待服务就绪超时：${lastError instanceof Error ? lastError.message : String(lastError)}`
  )
}

export async function initService(): Promise<void> {
  const currentKeyManager = await initKeyManager()
  const secret = await ensurePersistedServiceAuth(currentKeyManager)
  const execPath = servicePath()

  try {
    const principalArgs = await getAuthorizedPrincipalArgs()
    await execWithElevation(execPath, [
      'service',
      'init',
      '--public-key',
      secret.publicKey,
      ...principalArgs
    ])
  } catch (error) {
    if (isUserCancelledError(error)) {
      throw new UserCancelledError()
    }
    throw new Error(`服务初始化失败：${error instanceof Error ? error.message : String(error)}`)
  }

  await waitForServiceReady()
}

export async function installService(): Promise<void> {
  await runElevatedServiceCommand('install', '服务安装失败')
}

export async function uninstallService(): Promise<void> {
  await runElevatedServiceCommand('uninstall', '服务卸载失败')
}

export async function startService(): Promise<void> {
  await runElevatedServiceCommand('start', '服务启动失败')
}

export async function stopService(): Promise<void> {
  await runElevatedServiceCommand('stop', '服务停止失败')
}

export async function restartService(): Promise<void> {
  await runElevatedServiceCommand('restart', '服务重启失败')
}

function isNeedInitStatus(error: unknown): boolean {
  return (
    error instanceof ServiceAPIError &&
    error.status !== undefined &&
    [401, 403, 409, 503].includes(error.status)
  )
}

function isAccessDeniedError(error: unknown): boolean {
  const errorMsg = error instanceof Error ? error.message : String(error)
  return (
    errorMsg.includes('EACCES') ||
    errorMsg.includes('permission denied') ||
    errorMsg.includes('access is denied')
  )
}

export async function serviceStatus(): Promise<
  'running' | 'stopped' | 'not-installed' | 'paused' | 'unknown' | 'need-init'
> {
  const execPath = servicePath()

  try {
    const { stderr } = await execFilePromise(execPath, ['service', 'status'])
    if (stderr.includes('the service is not installed')) {
      return 'not-installed'
    }

    try {
      await ensureServiceAPIReady()
      await ping()
      try {
        await test()
        return 'running'
      } catch (error) {
        return isNeedInitStatus(error) ? 'need-init' : 'unknown'
      }
    } catch (e) {
      return isAccessDeniedError(e) ? 'need-init' : 'stopped'
    }
  } catch {
    return 'unknown'
  }
}

export async function testServiceConnection(): Promise<boolean> {
  try {
    await ensureServiceAPIReady()
    await test()
    return true
  } catch {
    return false
  }
}
