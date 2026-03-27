import { C, invokeSafe } from './ipc-core'

export async function resolveThemes(): Promise<{ key: string; label: string; content: string }[]> {
  return invokeSafe(C.resolveThemes)
}

export async function fetchThemes(): Promise<void> {
  return invokeSafe(C.fetchThemes)
}

export async function importThemes(files: string[]): Promise<void> {
  return invokeSafe(C.importThemes, files)
}

export async function readTheme(theme: string): Promise<string> {
  return invokeSafe(C.readTheme, theme)
}

export async function writeTheme(theme: string, css: string): Promise<void> {
  return invokeSafe(C.writeTheme, theme, css)
}

let applyThemeRunning = false
const waitList: string[] = []

export async function applyTheme(theme: string): Promise<void> {
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
