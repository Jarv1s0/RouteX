import fs from 'fs'
import path from 'path'
import plist from 'plist'
import { findBestAppPath, isIOSApp } from './icon'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath)
    return true
  } catch {
    return false
  }
}

export async function getAppName(appPath: string): Promise<string> {
  if (process.platform === 'darwin') {
    try {
      const targetPath = findBestAppPath(appPath)
      if (!targetPath) return ''

      if (isIOSApp(targetPath)) {
        const plistPath = path.join(targetPath, 'Info.plist')
        const xml = await fs.promises.readFile(plistPath, 'utf-8')
        const parsed = plist.parse(xml) as Record<string, unknown>
        return (parsed.CFBundleDisplayName as string) || (parsed.CFBundleName as string) || ''
      }

      try {
        const appName = await getLocalizedAppName(targetPath)
        if (appName) return appName
      } catch (err) {
        // ignore
      }

      const plistPath = path.join(targetPath, 'Contents', 'Info.plist')
      if (await fileExists(plistPath)) {
        const xml = await fs.promises.readFile(plistPath, 'utf-8')
        const parsed = plist.parse(xml) as Record<string, unknown>

        return (parsed.CFBundleDisplayName as string) || (parsed.CFBundleName as string) || ''
      } else {
        // ignore
      }
    } catch (err) {
      // ignore
    }
  }
  return ''
}

async function getLocalizedAppName(appPath: string): Promise<string> {
  const jxa = `
  ObjC.import('Foundation');
  const fm = $.NSFileManager.defaultManager;
  const name = fm.displayNameAtPath('${appPath}');
  name.js;
`
  try {
    const { stdout } = await execAsync(`osascript -l JavaScript -e "${jxa.replace(/\n/g, ' ')}"`)
    return stdout.trim()
  } catch (err) {
    throw new Error(`osascript execution failed: ${(err as Error).message}`)
  }
}
