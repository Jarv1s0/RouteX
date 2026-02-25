import { create } from 'zustand'
import throttle from 'lodash/throttle'

interface LogsState {
  logs: ControllerLog[]
  paused: boolean
  
  // Actions
  addLog: (log: ControllerLog) => void
  setLogs: (logs: ControllerLog[]) => void
  clearLogs: () => void
  setPaused: (paused: boolean) => void
  initializeListeners: () => void
  cleanupListeners: () => void
}

// Global buffer to avoid frequent state updates if not needed, 
// or we just throttle the setState.
// The previous implementation used a global object `cachedLogs`.
// We can replicate that but inside the store module scope.

const logBuffer: ControllerLog[] = []

const updateStore = throttle((logs: ControllerLog[]) => {
    useLogsStore.setState({ logs: logs.slice() })
}, 500, { leading: true, trailing: true })

const handleLog = (_e: unknown, log: ControllerLog) => {
    log.time = new Date().toLocaleString()
    logBuffer.push(log)
    if (logBuffer.length >= 500) {
        logBuffer.shift()
    }
    
    if (!useLogsStore.getState().paused) {
        updateStore(logBuffer)
    }
}

export const useLogsStore = create<LogsState>((set) => ({
  logs: [],
  paused: false,

  addLog: (log) => {
      handleLog(null, log)
  },

  setLogs: (logs) => set({ logs }),
  
  clearLogs: () => {
    logBuffer.length = 0
    set({ logs: [] })
  },

  setPaused: (paused) => {
      set({ paused })
      if (!paused) {
          // Sync buffer to state immediately when unpaused
          set({ logs: [...logBuffer] })
      }
  },

  initializeListeners: () => {
    window.electron.ipcRenderer.removeListener('mihomoLogs', handleLog)
    window.electron.ipcRenderer.on('mihomoLogs', handleLog)
  },

  cleanupListeners: () => {
    window.electron.ipcRenderer.removeListener('mihomoLogs', handleLog)
  }
}))
