import { copyFile, mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises'
import { themesDir } from '../utils/dirs'
import path from 'path'
import axios from 'axios'
import AdmZip from 'adm-zip'
import { getControledMihomoConfig } from '../config'
import { existsSync } from 'fs'
import { tmpdir } from 'os'
import { mainWindow } from '..'
import { floatingWindow } from './floatingWindow'

let insertedCSSKeyMain: string | undefined = undefined
let insertedCSSKeyFloating: string | undefined = undefined
const THEME_ZIP_URL = 'https://github.com/Jarv1s0/theme-hub/releases/download/latest/themes.zip'
const DEFAULT_THEME = { key: 'default.css', label: '默认' }
const THEME_DOWNLOAD_TIMEOUT_MS = 30000
const THEME_ZIP_MAX_SIZE = 10 * 1024 * 1024

function assertThemeFileName(theme: string): string {
  const fileName = path.basename(theme)
  if (fileName !== theme || path.extname(fileName).toLowerCase() !== '.css') {
    throw new Error(`Invalid theme file name: ${theme}`)
  }
  return fileName
}

function getThemePath(theme: string): string {
  return path.join(themesDir(), assertThemeFileName(theme))
}

function resolveThemeLabel(file: string, css: string): string {
  if (!css.startsWith('/*')) {
    return file
  }

  return css.split('\n')[0].replace('/*', '').replace('*/', '').trim() || file
}

function getArchiveThemeEntries(zip: AdmZip) {
  return zip.getEntries().filter((entry) => {
    if (entry.isDirectory) {
      return false
    }

    const normalizedName = entry.entryName.replace(/\\/g, '/')
    const fileName = path.posix.basename(normalizedName)
    return fileName === normalizedName && path.extname(fileName).toLowerCase() === '.css'
  })
}

export async function resolveThemes(): Promise<{ key: string; label: string }[]> {
  const files = await readdir(themesDir())
  const themes = await Promise.all(
    files
      .filter((file) => file.endsWith('.css'))
      .map(async (file) => {
        const css = (await readFile(getThemePath(file), 'utf-8')) || ''
        return { key: file, label: resolveThemeLabel(file, css) }
      })
  )

  return themes.some((theme) => theme.key === DEFAULT_THEME.key) ? themes : [DEFAULT_THEME, ...themes]
}

export async function fetchThemes(): Promise<void> {
  const { 'mixed-port': mixedPort = 7890 } = await getControledMihomoConfig()
  const zipData = await axios.get(THEME_ZIP_URL, {
    responseType: 'arraybuffer',
    timeout: THEME_DOWNLOAD_TIMEOUT_MS,
    maxContentLength: THEME_ZIP_MAX_SIZE,
    maxBodyLength: THEME_ZIP_MAX_SIZE,
    headers: { 'Content-Type': 'application/octet-stream' },
    ...(mixedPort != 0 && {
      proxy: {
        protocol: 'http',
        host: '127.0.0.1',
        port: mixedPort
      }
    })
  })

  const zip = new AdmZip(zipData.data as Buffer)
  const entries = getArchiveThemeEntries(zip)
  if (entries.length === 0) {
    throw new Error('No CSS themes found in archive')
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), 'routex-themes-'))

  try {
    for (const entry of entries) {
      const fileName = assertThemeFileName(path.posix.basename(entry.entryName.replace(/\\/g, '/')))
      await writeFile(path.join(tempDir, fileName), entry.getData())
    }

    for (const entry of entries) {
      const fileName = assertThemeFileName(path.posix.basename(entry.entryName.replace(/\\/g, '/')))
      await copyFile(path.join(tempDir, fileName), getThemePath(fileName))
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

export async function importThemes(files: string[]): Promise<void> {
  for (const file of files) {
    if (!existsSync(file)) {
      continue
    }

    const fileName = assertThemeFileName(path.basename(file))
    await copyFile(file, getThemePath(`${new Date().getTime().toString(16)}-${fileName}`))
  }
}

export async function readTheme(theme: string): Promise<string> {
  const themePath = getThemePath(theme)
  if (!existsSync(themePath)) return ''
  return await readFile(themePath, 'utf-8')
}

export async function writeTheme(theme: string, css: string): Promise<void> {
  await writeFile(getThemePath(theme), css)
}

export async function applyTheme(theme: string): Promise<void> {
  const css = await readTheme(theme)
  await mainWindow?.webContents.removeInsertedCSS(insertedCSSKeyMain || '')
  insertedCSSKeyMain = await mainWindow?.webContents.insertCSS(css)
  try {
    await floatingWindow?.webContents.removeInsertedCSS(insertedCSSKeyFloating || '')
    insertedCSSKeyFloating = await floatingWindow?.webContents.insertCSS(css)
  } catch {
    // ignore
  }
}
