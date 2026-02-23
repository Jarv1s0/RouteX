import { create } from 'zustand'
import { mihomoGroups, mihomoGroupDelay } from '@renderer/utils/ipc'

interface GroupsState {
  groups: ControllerMixedGroup[] | undefined
  isLoading: boolean
  
  // Actions
  fetchGroups: () => Promise<void>
  initializeListeners: () => void
  cleanupListeners: () => void
  runInitialTest: () => Promise<void>
}

let updateTimer: NodeJS.Timeout | null = null
let hasInitialTestRun = false

// 精确的监听器引用，避免使用 removeAllListeners
let currentGroupsHandler: (() => void) | null = null
let currentCoreStartedHandler: (() => void) | null = null

function unregisterGroupHandlers(): void {
  if (currentGroupsHandler) {
    window.electron.ipcRenderer.removeListener('groupsUpdated', currentGroupsHandler)
    currentGroupsHandler = null
  }
  if (currentCoreStartedHandler) {
    window.electron.ipcRenderer.removeListener('core-started', currentCoreStartedHandler)
    currentCoreStartedHandler = null
  }
}

export const useGroupsStore = create<GroupsState>((set, get) => ({
  groups: undefined,
  isLoading: true,

  fetchGroups: async () => {
    try {
      const groups = await mihomoGroups()
      set({ groups, isLoading: false })
    } catch (e) {
      console.error('Failed to fetch groups', e)
    }
  },

  initializeListeners: () => {
    // 先清理旧的监听器
    unregisterGroupHandlers()

    const handleUpdate = (): void => {
      get().fetchGroups()
    }

    // 保存引用并注册
    currentGroupsHandler = handleUpdate
    currentCoreStartedHandler = handleUpdate
    window.electron.ipcRenderer.on('groupsUpdated', handleUpdate)
    window.electron.ipcRenderer.on('core-started', handleUpdate)
    
    // Initial fetch
    get().fetchGroups()
    
    // Polling interval (matches original SWR logic: 10000ms)
    if (updateTimer) clearInterval(updateTimer)
    updateTimer = setInterval(() => {
      get().fetchGroups()
    }, 10000)

    // Initial speed test check
    get().runInitialTest()
  },

  cleanupListeners: () => {
    unregisterGroupHandlers()
    if (updateTimer) {
      clearInterval(updateTimer)
      updateTimer = null
    }
  },

  runInitialTest: async () => {
    if (hasInitialTestRun) return

    let currentGroups = get().groups
    if (!currentGroups || currentGroups.length === 0) {
      try {
        currentGroups = await mihomoGroups()
        set({ groups: currentGroups, isLoading: false })
      } catch {
        return
      }
    }

    if (!currentGroups || currentGroups.length === 0) return

    hasInitialTestRun = true
    const promises = currentGroups.map((g) => 
      mihomoGroupDelay(g.name, g.testUrl).catch((e) => {
        console.error(`[AutoDelay] Failed for group ${g.name}:`, e)
      })
    )
    await Promise.allSettled(promises)
    // Fetch again to update delay info
    get().fetchGroups()
  }
}))
