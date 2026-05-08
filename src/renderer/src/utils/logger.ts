export function isRendererDiagnosticsEnabled(): boolean {
  return import.meta.env.DEV || __ROUTEX_BUILD_VARIANT__ === 'dev'
}

export function debugLog(...args: unknown[]): void {
  if (isRendererDiagnosticsEnabled()) {
    console.debug(...args)
  }
}

export function infoLog(...args: unknown[]): void {
  if (isRendererDiagnosticsEnabled()) {
    console.info(...args)
  }
}

export function warnLog(...args: unknown[]): void {
  if (isRendererDiagnosticsEnabled()) {
    console.warn(...args)
  }
}
