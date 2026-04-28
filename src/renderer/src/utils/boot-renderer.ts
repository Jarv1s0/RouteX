function normalizeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: error.message || String(error),
      stack: error.stack
    }
  }

  return {
    message: typeof error === 'string' ? error : JSON.stringify(error, null, 2)
  }
}

function isDynamicImportFetchError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : JSON.stringify(error)

  return message.includes('Failed to fetch dynamically imported module')
}

function tryRecoverDynamicImport(entryName: string, error: unknown): boolean {
  if (!isDynamicImportFetchError(error)) {
    return false
  }

  const reloadMarker = `routex:dynamic-import-reload:${entryName}`

  try {
    if (window.sessionStorage.getItem(reloadMarker) === '1') {
      return false
    }

    window.sessionStorage.setItem(reloadMarker, '1')
  } catch {
    return false
  }

  traceBootStep(entryName, 'entry:import:recover:reload', error)
  window.location.reload()
  return true
}

export function traceBootStep(entryName: string, step: string, detail?: unknown): void {
  if (detail instanceof Error) {
    console.error(`[boot:${entryName}] ${step}`, detail)
    return
  }

  if (detail !== undefined) {
    console.info(`[boot:${entryName}] ${step}`, detail)
    return
  }

  console.info(`[boot:${entryName}] ${step}`)
}

function renderFatalScreen(entryName: string, error: unknown): void {
  const { message, stack } = normalizeError(error)
  const root = document.getElementById('root')

  if (!root) {
    console.error(`[boot:${entryName}] root container not found`, error)
    return
  }

  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#0f172a;color:#e2e8f0;font-family:'JetBrains Mono','Consolas',monospace;">
      <div style="width:min(960px,100%);background:rgba(15,23,42,0.92);border:1px solid rgba(148,163,184,0.28);border-radius:20px;padding:24px;box-shadow:0 20px 50px rgba(0,0,0,0.35);">
        <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#fda4af;margin-bottom:12px;">Renderer Boot Failed</div>
        <div style="font-size:24px;font-weight:700;color:#f8fafc;margin-bottom:12px;">${entryName} 入口加载失败</div>
        <div style="font-size:14px;line-height:1.6;color:#cbd5e1;margin-bottom:16px;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        ${
          stack
            ? `<pre style="margin:0;white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.6;color:#93c5fd;background:rgba(2,6,23,0.72);border-radius:12px;padding:16px;overflow:auto;">${stack.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`
            : ''
        }
      </div>
    </div>
  `
}

export async function bootRenderer(entryName: string, loader: () => Promise<unknown>): Promise<void> {
  traceBootStep(entryName, 'entry:boot')

  window.addEventListener('error', (event) => {
    traceBootStep(entryName, 'window:error', event.error ?? event.message)
    console.error(`[boot:${entryName}] window error`, event.error ?? event.message)
  })

  window.addEventListener('unhandledrejection', (event) => {
    traceBootStep(entryName, 'window:unhandledrejection', event.reason)
    console.error(`[boot:${entryName}] unhandled rejection`, event.reason)
  })

  try {
    traceBootStep(entryName, 'entry:import:start')
    await loader()
    try {
      window.sessionStorage.removeItem(`routex:dynamic-import-reload:${entryName}`)
    } catch {
      // ignore sessionStorage failures
    }
    traceBootStep(entryName, 'entry:import:done')
  } catch (error) {
    if (tryRecoverDynamicImport(entryName, error)) {
      return
    }
    traceBootStep(entryName, 'entry:import:failed', error)
    console.error(`[boot:${entryName}] entry import failed`, error)
    renderFatalScreen(entryName, error)
  }
}
