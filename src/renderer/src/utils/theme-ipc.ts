import { C, invokeSafe } from './ipc-core'
import { isTauriVirtualFile, readTauriVirtualFile } from '@renderer/api/desktop'

function isTauriHost(): boolean {
  return __ROUTEX_HOST__ === 'tauri'
}

export async function resolveThemes(): Promise<{ key: string; label: string; content: string }[]> {
  if (isTauriHost()) {
    return invokeSafe(C.resolveThemes)
  }

  return invokeSafe(C.resolveThemes)
}

export async function fetchThemes(): Promise<void> {
  if (isTauriHost()) {
    return invokeSafe(C.fetchThemes)
  }

  return invokeSafe(C.fetchThemes)
}

export function extractImportedThemeName(file: string): string {
  const baseName = file.split(/[\\/]/).pop() || 'Imported.css'
  if (!isTauriVirtualFile(file)) {
    return baseName
  }

  try {
    return decodeURIComponent(baseName)
  } catch {
    return baseName
  }
}

export async function importThemes(files: string[]): Promise<void> {
  if (isTauriHost()) {
    for (const file of files) {
      const css = isTauriVirtualFile(file)
        ? await readTauriVirtualFile(file)
        : await invokeSafe<string>(C.readTextFile, file)
      const name = extractImportedThemeName(file)
      await writeTheme(name, css || '')
    }
    return
  }

  return invokeSafe(C.importThemes, files)
}

export async function readTheme(theme: string): Promise<string> {
  if (isTauriHost()) {
    return invokeSafe(C.readTheme, theme)
  }

  return invokeSafe(C.readTheme, theme)
}

export async function writeTheme(theme: string, css: string): Promise<void> {
  if (isTauriHost()) {
    return invokeSafe(C.writeTheme, theme, css)
  }

  return invokeSafe(C.writeTheme, theme, css)
}

let applyThemeRunning = false
const waitList: string[] = []
const TAURI_THEME_STYLE_ID = 'routex-tauri-theme-style'
const REDUCE_TRANSPARENCY_CLASS = 'reduce-transparency'

export function applyReduceTransparencyClass(enabled?: boolean): void {
  document.documentElement.classList.toggle(REDUCE_TRANSPARENCY_CLASS, Boolean(enabled))
}

export function upsertTauriThemeStyle(css: string): void {
  const existing = document.getElementById(TAURI_THEME_STYLE_ID)

  if (!css.trim()) {
    existing?.remove()
    return
  }

  if (existing && existing.textContent === css) {
    return
  }

  const style = existing ?? document.createElement('style')
  style.id = TAURI_THEME_STYLE_ID
  style.textContent = css

  if (!existing) {
    document.head.appendChild(style)
  }
}

export async function applyTheme(theme: string): Promise<void> {
  if (isTauriHost()) {
    if (document.documentElement.dataset['routexTheme'] !== theme) {
      document.documentElement.dataset['routexTheme'] = theme
    }
    const css = await readTheme(theme)
    upsertTauriThemeStyle(css)
    return
  }

  if (applyThemeRunning) {
    waitList.push(theme)
    return
  }

  applyThemeRunning = true
  try {
    await invokeSafe(C.applyTheme, theme)
  } finally {
    applyThemeRunning = false
    if (waitList.length > 0) {
      await applyTheme(waitList.shift() || '')
    }
  }
}
