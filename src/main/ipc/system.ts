import { registerIpcInvokeHandlers } from '../utils/ipc'
import { createDataHandlers } from './system/data'
import { createFileHandlers } from './system/files'
import { createRuntimeHandlers } from './system/runtime'
import { createUiHandlers } from './system/ui'

// 系统、服务、窗口、主题及杂项 IPC 处理器
export function registerSystemHandlers(): void {
  registerIpcInvokeHandlers({
    ...createRuntimeHandlers(),
    ...createFileHandlers(),
    ...createUiHandlers(),
    ...createDataHandlers()
  })
}
