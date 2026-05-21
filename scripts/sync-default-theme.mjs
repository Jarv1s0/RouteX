import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const themeFileName = 'routex-blue-glass.css'
const routexThemePath = resolve(repoRoot, 'src-tauri/resources/themes', themeFileName)
const defaultThemeHubPath = resolve(repoRoot, '../theme-hub/themes', themeFileName)
const sourceThemePath = resolve(process.env.ROUTEX_THEME_HUB_CSS || defaultThemeHubPath)
const checkOnly = process.argv.includes('--check')

async function readNormalized(path) {
  return (await readFile(path, 'utf8')).replace(/\r\n/g, '\n')
}

if (!existsSync(sourceThemePath)) {
  console.error(`[default-theme] source theme not found: ${sourceThemePath}`)
  console.error('[default-theme] set ROUTEX_THEME_HUB_CSS to the theme-hub routex-blue-glass.css path')
  process.exit(1)
}

const sourceCss = await readNormalized(sourceThemePath)

if (checkOnly) {
  if (!existsSync(routexThemePath)) {
    console.error(`[default-theme] bundled theme not found: ${routexThemePath}`)
    process.exit(1)
  }

  const bundledCss = await readNormalized(routexThemePath)
  if (bundledCss !== sourceCss) {
    console.error('[default-theme] bundled RouteX Blue Glass theme is out of sync with theme-hub')
    console.error(`[default-theme] source: ${sourceThemePath}`)
    console.error(`[default-theme] bundled: ${routexThemePath}`)
    process.exit(1)
  }

  console.log('[default-theme] bundled RouteX Blue Glass theme is in sync')
  process.exit(0)
}

await mkdir(dirname(routexThemePath), { recursive: true })
await writeFile(routexThemePath, sourceCss, 'utf8')
console.log(`[default-theme] synced ${sourceThemePath} -> ${routexThemePath}`)
