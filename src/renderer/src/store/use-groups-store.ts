import { create } from 'zustand'
import { mihomoGroups } from '@renderer/utils/mihomo-ipc'
import { ON, onIpc } from '@renderer/utils/ipc-channels'

interface GroupsState {
  groups: ControllerMixedGroup[] | undefined
  isLoading: boolean
  
  // Actions
  fetchGroups: () => Promise<void>
  initializeListeners: () => void
  cleanupListeners: () => void
}

let updateTimer: NodeJS.Timeout | null = null
let groupsListenerRefCount = 0

function isExpectedMihomoUnavailableError(error: unknown): boolean {
  const message = `${error ?? ''}`
  return (
    message.includes('connect ENOENT \\\\.\\pipe\\RouteX\\mihomo') ||
    message.includes('connect ENOENT \\\\.\\pipe\\Sparkle\\mihomo') ||
    message.includes('socket hang up')
  )
}

// 精确的监听器引用，避免使用 removeAllListeners
let currentGroupsCleanup: (() => void) | null = null
let currentCoreStartedCleanup: (() => void) | null = null

function unregisterGroupHandlers(): void {
  currentGroupsCleanup?.()
  currentGroupsCleanup = null
  currentCoreStartedCleanup?.()
  currentCoreStartedCleanup = null
}

export const useGroupsStore = create<GroupsState>((set, get) => ({
  groups: undefined,
  isLoading: true,

  fetchGroups: async () => {
    try {
      const groups = await mihomoGroups()
      set({ groups, isLoading: false })
    } catch (e) {
      set({ isLoading: false })
      if (!isExpectedMihomoUnavailableError(e)) {
        console.error('Failed to fetch groups', e)
      }
    }
  },

  initializeListeners: () => {
    // 先清理旧的监听器
    unregisterGroupHandlers()

    const handleUpdate = (): void => {
      get().fetchGroups()
    }

    // 保存引用并注册
    currentGroupsCleanup = onIpc(ON.groupsUpdated, handleUpdate)
    currentCoreStartedCleanup = onIpc(ON.coreStarted, handleUpdate)
    
    // Initial fetch
    get().fetchGroups()
    
    // Polling interval (matches original SWR logic: 10000ms)
    if (updateTimer) clearInterval(updateTimer)
    updateTimer = setInterval(() => {
      // 窗口不可见时跳过轮询
      if (!document.hidden) get().fetchGroups()
    }, 30000) // 30s 足够，代理组变化已由事件驱动
  },

  cleanupListeners: () => {
    unregisterGroupHandlers()
    if (updateTimer) {
      clearInterval(updateTimer)
      updateTimer = null
    }
  }
}))

export function retainGroupsListeners(): void {
  groupsListenerRefCount += 1
  if (groupsListenerRefCount === 1) {
    useGroupsStore.getState().initializeListeners()
  }
}

export function releaseGroupsListeners(): void {
  if (groupsListenerRefCount === 0) {
    return
  }

  groupsListenerRefCount -= 1
  if (groupsListenerRefCount === 0) {
    useGroupsStore.getState().cleanupListeners()
  }
}
