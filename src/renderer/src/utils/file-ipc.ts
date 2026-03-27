import { C, invokeSafe } from './ipc-core'

export async function getFilePath(ext: string[]): Promise<string[] | undefined> {
  return invokeSafe(C.getFilePath, ext)
}

export async function saveFile(content: string, defaultName: string, ext: string): Promise<boolean> {
  return invokeSafe(C.saveFile, content, defaultName, ext)
}

export async function readTextFile(filePath: string): Promise<string> {
  return invokeSafe(C.readTextFile, filePath)
}

export async function getFileStr(id: string): Promise<string> {
  return invokeSafe(C.getFileStr, id)
}

export async function setFileStr(id: string, str: string): Promise<void> {
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
