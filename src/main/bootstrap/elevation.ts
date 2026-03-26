import { app, dialog } from 'electron'
import { createElevateTask } from '../sys/misc'
import { copyFileSync, existsSync, writeFileSync } from 'fs'
import { resourcesFilesDir, taskDir } from '../utils/dirs'
import path from 'path'

async function execSchtasks(command: string): Promise<void> {
  const { promisify } = await import('util')
  const { exec } = await import('child_process')
  const execPromise = promisify(exec)
  await execPromise(command)
}

async function hasSparkleRunTask(): Promise<boolean> {
  try {
    await execSchtasks('%SystemRoot%\\System32\\schtasks.exe /query /tn "sparkle-run"')
    return true
  } catch {
    return false
  }
}

function writeTaskParams(argv: string[]): void {
  const args = argv.slice(1)
  writeFileSync(path.join(taskDir(), 'param.txt'), args.length > 0 ? args.join(' ') : 'empty')
}

function ensureSparkleRunBinary(): void {
  const sparkleRunDest = path.join(taskDir(), 'sparkle-run.exe')
  if (existsSync(sparkleRunDest)) {
    return
  }

  const sparkleRunSrc = path.join(resourcesFilesDir(), 'sparkle-run.exe')
  if (existsSync(sparkleRunSrc)) {
    copyFileSync(sparkleRunSrc, sparkleRunDest)
  }
}

interface EnsureElevationOptions {
  isDev: boolean
  argv: string[]
  corePermissionMode?: AppConfig['corePermissionMode']
}

export async function ensureElevatedStartup(options: EnsureElevationOptions): Promise<boolean> {
  const { isDev, argv, corePermissionMode } = options

  if (
    process.platform !== 'win32' ||
    isDev ||
    argv.includes('noadmin') ||
    corePermissionMode === 'service'
  ) {
    return true
  }

  try {
    await createElevateTask()
    return true
  } catch (createError) {
    const taskExists = await hasSparkleRunTask()

    if (!taskExists) {
      dialog.showErrorBox(
        '需要管理员权限',
        '首次启动需要管理员权限来创建系统任务。\n\n请右键点击应用图标，选择"以管理员身份运行"。'
      )
      app.exit()
      return false
    }

    try {
      writeTaskParams(argv)
      ensureSparkleRunBinary()
      await execSchtasks('%SystemRoot%\\System32\\schtasks.exe /run /tn "sparkle-run"')
      app.exit()
      return false
    } catch (runError) {
      dialog.showErrorBox('启动失败', `无法启动应用\n${createError}\n${runError}`)
      app.exit()
      return false
    }
  }
}
