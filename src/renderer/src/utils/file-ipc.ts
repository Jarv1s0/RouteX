import { C, invokeSafe } from './ipc-core'
import { isTauriVirtualFile, pickTauriFiles, readTauriVirtualFile } from '@renderer/api/desktop'

function isTauriHost(): boolean {
  return __ROUTEX_HOST__ === 'tauri'
}

export async function getFilePath(ext: string[]): Promise<string[] | undefined> {
  if (isTauriHost()) {
    try {
      return invokeSafe(C.getFilePath, ext)
    } catch {
      return pickTauriFiles(ext)
    }
  }

  return invokeSafe(C.getFilePath, ext)
}

export async function saveFile(content: string, defaultName: string, ext: string): Promise<boolean> {
  if (isTauriHost()) {
    try {
      return invokeSafe(C.saveFile, content, defaultName, ext)
    } catch {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = defaultName.endsWith(`.${ext}`) ? defaultName : `${defaultName}.${ext}`
      anchor.click()
      URL.revokeObjectURL(url)
      return true
    }
  }

  return invokeSafe(C.saveFile, content, defaultName, ext)
}

export async function readTextFile(filePath: string): Promise<string> {
  if (isTauriHost()) {
    if (isTauriVirtualFile(filePath)) {
      return (await readTauriVirtualFile(filePath)) || ''
    }

    return invokeSafe(C.readTextFile, filePath)
  }

  return invokeSafe(C.readTextFile, filePath)
}

export async function getFileStr(id: string): Promise<string> {
  if (isTauriHost()) {
    return invokeSafe(C.getFileStr, id)
  }

  return invokeSafe(C.getFileStr, id)
}

export async function setFileStr(id: string, str: string): Promise<void> {
  if (isTauriHost()) {
    return invokeSafe(C.setFileStr, id, str)
  }

  return invokeSafe(C.setFileStr, id, str)
}

export async function convertMrsRuleset(path: string, behavior: string): Promise<string> {
  return invokeSafe(C.convertMrsRuleset, path, behavior)
}

export async function openFile(
  type: 'profile' | 'override',
  id: string,
  ext?: 'yaml' | 'js'
): Promise<void> {
  return invokeSafe(C.openFile, type, id, ext)
}
