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
let unavailableRetryTimer: number | null = null
let groupsListenerRefCount = 0

function isExpectedMihomoUnavailableError(error: unknown): boolean {
  const message = `${error ?? ''}`
  return (
    message.includes('connect ENOENT \\\\.\\pipe\\RouteX\\mihomo') ||
    message.includes('socket hang up') ||
    message.includes('Mihomo controller is not available') ||
    message.includes('503 Service Unavailable') ||
    message.includes('504 Gateway Timeout')
  )
}

// 精确的监听器引用，避免使用 removeAllListeners
let currentGroupsCleanup: (() => void) | null = null
let currentCoreStartedCleanup: (() => void) | null = null
let currentVisibilityChangeHandler: (() => void) | null = null

function clearUpdateTimer(): void {
  if (!updateTimer) {
    return
  }

  clearInterval(updateTimer)
  updateTimer = null
}

function clearUnavailableRetryTimer(): void {
  if (unavailableRetryTimer === null) {
    return
  }

  window.clearTimeout(unavailableRetryTimer)
  unavailableRetryTimer = null
}

function unregisterGroupHandlers(): void {
  currentGroupsCleanup?.()
  currentGroupsCleanup = null
  currentCoreStartedCleanup?.()
  currentCoreStartedCleanup = null
  if (currentVisibilityChangeHandler) {
    document.removeEventListener('visibilitychange', currentVisibilityChangeHandler)
    currentVisibilityChangeHandler = null
  }
}

export const useGroupsStore = create<GroupsState>((set, get) => ({
  groups: undefined,
  isLoading: true,

  fetchGroups: async () => {
    try {
      const groups = await mihomoGroups()
      clearUnavailableRetryTimer()
      set({ groups, isLoading: false })
    } catch (e) {
      if (isExpectedMihomoUnavailableError(e)) {
        const previousGroups = get().groups
        set({
          groups: previousGroups,
          isLoading: !previousGroups || previousGroups.length === 0
        })

        if (unavailableRetryTimer === null && !document.hidden) {
          unavailableRetryTimer = window.setTimeout(() => {
            unavailableRetryTimer = null
            void get().fetchGroups()
          }, 1200)
        }
        return
      }

      clearUnavailableRetryTimer()
      set({ groups: [], isLoading: false }) // 失败时提供稳定的空数组引用
      console.error('Failed to fetch groups', e)
    }
  },

  initializeListeners: () => {
    // 先清理旧的监听器
    unregisterGroupHandlers()
    clearUpdateTimer()

    const fetchGroups = (): void => void get().fetchGroups()

    // 保存引用并注册
    currentGroupsCleanup = onIpc(ON.groupsUpdated, fetchGroups)
    currentCoreStartedCleanup = onIpc(ON.coreStarted, fetchGroups)
    currentVisibilityChangeHandler = () => {
      if (!document.hidden) {
        fetchGroups()
      }
    }
    document.addEventListener('visibilitychange', currentVisibilityChangeHandler)

    // Initial fetch
    fetchGroups()

    // Polling interval (matches original SWR logic: 10000ms)
    updateTimer = setInterval(() => {
      // 窗口不可见时跳过轮询
      if (!document.hidden) fetchGroups()
    }, 30000) // 30s 足够，代理组变化已由事件驱动
  },

  cleanupListeners: () => {
    unregisterGroupHandlers()
    clearUpdateTimer()
    clearUnavailableRetryTimer()
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
