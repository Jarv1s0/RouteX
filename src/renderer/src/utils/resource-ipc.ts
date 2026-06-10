import { C, invokeSafe } from './ipc-core'

function isTauriHost(): boolean {
  return __ROUTEX_HOST__ === 'tauri'
}

function isDirectResource(value: string): boolean {
  return /^data:/i.test(value) || /^https?:\/\//i.test(value)
}

function isDataResource(value: string): boolean {
  return /^data:/i.test(value)
}

export async function getAppName(appPath: string): Promise<string> {
  return invokeSafe(C.getAppName, appPath)
}

export async function getImageDataURL(url: string): Promise<string> {
  if (isTauriHost()) {
    if (isDataResource(url)) {
      return url
    }

    if (url.trim().startsWith('<svg')) {
      return `data:image/svg+xml;utf8,${url}`
    }

    return invokeSafe(C.getImageDataURL, url)
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
