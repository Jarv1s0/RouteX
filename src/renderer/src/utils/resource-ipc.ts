import { C, invokeSafe } from './ipc-core'

export async function getAppName(appPath: string): Promise<string> {
  return invokeSafe(C.getAppName, appPath)
}

export async function getImageDataURL(url: string): Promise<string> {
  return invokeSafe(C.getImageDataURL, url)
}

export async function getIconDataURL(appPath: string): Promise<string> {
  return invokeSafe(C.getIconDataURL, appPath)
}
