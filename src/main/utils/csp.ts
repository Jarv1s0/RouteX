import { session } from 'electron'
import { DEV_RENDERER_CSP } from '../../shared/csp'

const APP_ENTRY_PATHS = new Set(['/', '/index.html', '/floating.html', '/traymenu.html'])

function shouldApplyRendererCsp(url: string): boolean {
  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (!rendererUrl) return false

  try {
    const target = new URL(url)
    const renderer = new URL(rendererUrl)
    return target.origin === renderer.origin && APP_ENTRY_PATHS.has(target.pathname)
  } catch {
    return false
  }
}

export function registerRendererCsp(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (details.resourceType !== 'mainFrame' || !shouldApplyRendererCsp(details.url)) {
      callback({ responseHeaders: details.responseHeaders })
      return
    }

    const responseHeaders = { ...(details.responseHeaders ?? {}) }
    for (const headerName of Object.keys(responseHeaders)) {
      if (headerName.toLowerCase() === 'content-security-policy') {
        delete responseHeaders[headerName]
      }
    }

    responseHeaders['Content-Security-Policy'] = [DEV_RENDERER_CSP]
    callback({ responseHeaders })
  })
}
