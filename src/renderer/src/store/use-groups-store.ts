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
    const handleUpdate = () => {
        get().fetchGroups()
    }

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
    window.electron.ipcRenderer.removeAllListeners('groupsUpdated')
    window.electron.ipcRenderer.removeAllListeners('core-started')
    if (updateTimer) {
        clearInterval(updateTimer)
        updateTimer = null
    }
  },

  runInitialTest: async () => {
    if (hasInitialTestRun) return

    // We need to wait for groups to be loaded. 
    // Since fetchGroups is async but we don't await it in initializeListeners (it's void),
    // we might need to check if groups are available.
    // If not, we can rely on the fact that fetchGroups calls set(), and we could listen to that?
    // Or just try nicely:
    let currentGroups = get().groups
    if (!currentGroups || currentGroups.length === 0) {
        // Try fetching once and await
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
