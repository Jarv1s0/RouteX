import { C, invokeSafe } from './ipc-core'

const DEFAULT_ICON_DATA_URL =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="%231f6feb"/><path d="M20 21h24a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H20a3 3 0 0 1-3-3V24a3 3 0 0 1 3-3Z" fill="%23fff" fill-opacity=".92"/><path d="M24 28h16M24 34h10" stroke="%231f6feb" stroke-width="4" stroke-linecap="round"/></svg>'

function isTauriHost(): boolean {
  return __ROUTEX_HOST__ === 'tauri'
}

function isDirectResource(value: string): boolean {
  return /^data:/i.test(value) || /^https?:\/\//i.test(value)
}

export async function getAppName(appPath: string): Promise<string> {
  return invokeSafe(C.getAppName, appPath)
}

export async function getImageDataURL(url: string): Promise<string> {
  if (isTauriHost()) {
    if (isDirectResource(url)) {
      return url
    }

    if (url.trim().startsWith('<svg')) {
      return `data:image/svg+xml;utf8,${url}`
    }

    return DEFAULT_ICON_DATA_URL
  }

  return invokeSafe(C.getImageDataURL, url)
}

export async function getIconDataURL(appPath: string): Promise<string> {
  if (isDirectResource(appPath)) {
    return appPath
  }

  return invokeSafe(C.getIconDataURL, appPath)
}

export async function getIconDataURLs(appPaths: string[]): Promise<Record<string, string>> {
  const nextIcons: Record<string, string> = {}
  const pendingPaths: string[] = []

  appPaths.forEach((appPath) => {
    if (!appPath) {
      return
    }

    if (isDirectResource(appPath)) {
      nextIcons[appPath] = appPath
      return
    }

    pendingPaths.push(appPath)
  })

  if (pendingPaths.length === 0) {
    return nextIcons
  }

  if (isTauriHost()) {
    const resolved = await invokeSafe<Record<string, string>>(C.getIconDataURLs, pendingPaths)
    return { ...nextIcons, ...resolved }
  }

  const entries = await Promise.all(
    pendingPaths.map(async (appPath) => [appPath, await getIconDataURL(appPath)] as const)
  )

  entries.forEach(([appPath, dataUrl]) => {
    nextIcons[appPath] = dataUrl
  })

  return nextIcons
}
