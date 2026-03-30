import path from 'path'
import v8 from 'v8'
import {
  getFilePath,
  saveFile,
  openFile,
  readTextFile
} from '../../sys/misc'
import {
  getRuntimeConfig,
  getRuntimeConfigStr,
  getRawProfileStr,
  getCurrentProfileStr,
  getOverrideProfileStr
} from '../../core/factory'
import { logDir } from '../../utils/dirs'
import { getGistUrl } from '../../resolve/gistApi'
import { getIconDataURL, getImageDataURL } from '../../utils/icon'
import { getAppName } from '../../utils/appName'
import { getUserAgent } from '../../utils/userAgent'
import { ipcErrorWrapper, type IpcInvokeHandlerMap } from '../../utils/ipc'
import { IPC_INVOKE_CHANNELS } from '../../../shared/ipc'

export function createFileHandlers(): IpcInvokeHandlerMap {
  const C = IPC_INVOKE_CHANNELS

  return {
    [C.getFilePath]: (_e, ext) => getFilePath(ext),
    [C.saveFile]: (_e, content, defaultName, ext) => saveFile(content, defaultName, ext),
    [C.readTextFile]: (_e, filePath) => ipcErrorWrapper(readTextFile)(filePath),
    [C.getRuntimeConfigStr]: () => ipcErrorWrapper(getRuntimeConfigStr)(),
    [C.getRawProfileStr]: () => ipcErrorWrapper(getRawProfileStr)(),
    [C.getCurrentProfileStr]: () => ipcErrorWrapper(getCurrentProfileStr)(),
    [C.getOverrideProfileStr]: () => ipcErrorWrapper(getOverrideProfileStr)(),
    [C.getRuntimeConfig]: () => ipcErrorWrapper(getRuntimeConfig)(),
    [C.getGistUrl]: () => ipcErrorWrapper(getGistUrl)(),
    [C.openFile]: (_e, type, id, ext) => openFile(type, id, ext),
    [C.createHeapSnapshot]: () => {
      v8.writeHeapSnapshot(path.join(logDir(), `${Date.now()}.heapsnapshot`))
    },
    [C.getUserAgent]: () => ipcErrorWrapper(getUserAgent)(),
    [C.getAppName]: (_e, appPath) => ipcErrorWrapper(getAppName)(appPath),
    [C.getImageDataURL]: (_e, url) => ipcErrorWrapper(getImageDataURL)(url),
    [C.getIconDataURL]: (_e, appPath) => ipcErrorWrapper(getIconDataURL)(appPath)
  }
}
