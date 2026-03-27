import { C, invokeSafe } from './ipc-core'

export async function webdavBackup(): Promise<boolean> {
  return invokeSafe(C.webdavBackup)
}

export async function webdavRestore(filename: string): Promise<void> {
  return invokeSafe(C.webdavRestore, filename)
}

export async function listWebdavBackups(): Promise<string[]> {
  return invokeSafe(C.listWebdavBackups)
}

export async function webdavDelete(filename: string): Promise<void> {
  return invokeSafe(C.webdavDelete, filename)
}
