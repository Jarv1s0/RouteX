import { app, dialog } from 'electron'
import { createElevateTask } from '../sys/misc'
import { copyFileSync, existsSync, writeFileSync } from 'fs'
import { routexRunPath, taskDir } from '../utils/dirs'
import { ROUTEX_RUN_BINARY, ROUTEX_RUN_TASK_NAME } from '../utils/routex-run'
import path from 'path'

async function execSchtasks(command: string): Promise<void> {
  const { promisify } = await import('util')
  const { exec } = await import('child_process')
  const execPromise = promisify(exec)
  await execPromise(command)
}

async function hasRoutexRunTask(): Promise<boolean> {
  try {
    await execSchtasks(`%SystemRoot%\\System32\\schtasks.exe /query /tn "${ROUTEX_RUN_TASK_NAME}"`)
    return true
  } catch {
    return false
  }
}

function writeTaskParams(argv: string[]): void {
  const args = argv.slice(1)
  writeFileSync(path.join(taskDir(), 'param.txt'), args.length > 0 ? args.join(' ') : 'empty')
}

function ensureRoutexRunBinary(): void {
  const routexRunDest = path.join(taskDir(), ROUTEX_RUN_BINARY)
  if (existsSync(routexRunDest)) {
    return
  }

  copyFileSync(routexRunPath(), routexRunDest)
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
    if (!(await hasRoutexRunTask())) {
      dialog.showErrorBox(
        '需要管理员权限',
        '首次启动需要管理员权限来创建系统任务。\n\n请右键点击应用图标，选择"以管理员身份运行"。'
      )
      app.exit()
      return false
    }

    try {
      writeTaskParams(argv)
      ensureRoutexRunBinary()
      await execSchtasks(`%SystemRoot%\\System32\\schtasks.exe /run /tn "${ROUTEX_RUN_TASK_NAME}"`)
      app.exit()
      return false
    } catch (runError) {
      dialog.showErrorBox('启动失败', `无法启动应用\n${createError}\n${runError}`)
      app.exit()
      return false
    }
  }
}
