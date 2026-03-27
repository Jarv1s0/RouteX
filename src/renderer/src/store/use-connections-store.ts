import { create } from 'zustand'
import { ON, onIpc } from '@renderer/utils/ipc-channels'

export interface ExtendedConnection extends ControllerConnectionDetail {
  isActive: boolean
  downloadSpeed: number
  uploadSpeed: number
  completedAt?: string
}

interface ConnectionsState {
  activeConnections: ExtendedConnection[]
  closedConnections: ExtendedConnection[]
  connectionCount: number
  loading: boolean
  memory: number
  
  isPaused: boolean
  
  // Actions
  initializeListeners: () => void
  cleanupListeners: () => void
  setPaused: (paused: boolean) => void
  
  // Management actions
  closeConnection: (id: string) => void
  closeAllConnections: () => void
  trashClosedConnection: (id: string) => void
  trashAllClosedConnections: () => void
}

type ConnectionSnapshotListener = (snapshot: ControllerConnections) => void

const connectionSnapshotListeners = new Set<ConnectionSnapshotListener>()
let latestConnectionSnapshot: ControllerConnections | null = null

function emitConnectionSnapshot(snapshot: ControllerConnections): void {
  latestConnectionSnapshot = snapshot
  connectionSnapshotListeners.forEach((listener) => {
    try {
      listener(snapshot)
    } catch (error) {
      console.error('Connection snapshot listener failed', error)
    }
  })
}

export function subscribeConnectionSnapshot(
  listener: ConnectionSnapshotListener,
  emitCurrent = true
): () => void {
  connectionSnapshotListeners.add(listener)

  if (emitCurrent && latestConnectionSnapshot) {
    listener(latestConnectionSnapshot)
  }

  return () => {
    connectionSnapshotListeners.delete(listener)
  }
}

export const useConnectionsStore = create<ConnectionsState>((set, get) => ({
  activeConnections: [],
  closedConnections: [],
  connectionCount: 0,
  loading: true,
  memory: 0,
  isPaused: false,

  setPaused: (paused: boolean) => set({ isPaused: paused }),

  initializeListeners: () => {
    const handleConnections = (_e: unknown, info: ControllerConnections): void => {
      if (!info || !info.connections) return

      // 先把解析后的连接快照广播出去，供其他 store 复用，避免重复监听和重复 JSON.parse。
      emitConnectionSnapshot(info)

      const { isPaused } = get()
      if (isPaused) return
      // 窗口不可见时跳过列表衍生计算，降低后台 CPU 占用
      if (document.hidden) return
      
      const { activeConnections: prevActive, closedConnections: prevClosed } = get()
      const prevActiveMap = new Map(prevActive.map((c) => [c.id, c]))
      
      const newActive: ExtendedConnection[] = info.connections.map((conn) => {
        const prev = prevActiveMap.get(conn.id)
        const downloadSpeed = prev ? conn.download - prev.download : 0
        const uploadSpeed = prev ? conn.upload - prev.upload : 0
        
        // Enhance metadata if needed (e.g. for Inner type)
        const metadata = conn.metadata.type === 'Inner' 
          ? { ...conn.metadata, process: 'mihomo', processPath: 'mihomo' }
          : conn.metadata

        // Optimize object creation: reuse previous object if nothing substantial changed
        if (
          prev &&
          prev.upload === conn.upload &&
          prev.download === conn.download &&
          prev.chains?.[0] === conn.chains?.[0] &&
          // 比较 rule 等可能会变的参数，如果没变就复用
          prev.rule === conn.rule &&
          prev.start === conn.start
        ) {
           if (downloadSpeed === 0 && uploadSpeed === 0 && prev.downloadSpeed === 0 && prev.uploadSpeed === 0) {
             return prev
           }
        }

        return {
          ...conn,
          metadata,
          isActive: true,
          downloadSpeed: Math.max(0, downloadSpeed),
          uploadSpeed: Math.max(0, uploadSpeed)
        }
      })
      
      // Identify newly closed connections
      // Connections that were in prevActive but are NOT in newActive
      const newActiveIds = new Set(newActive.map(c => c.id))
      const newlyClosed = prevActive
        .filter(c => !newActiveIds.has(c.id))
        .map(c => ({ 
          ...c, 
          isActive: false, 
          downloadSpeed: 0, 
          uploadSpeed: 0,
          completedAt: new Date().toISOString()
        }))
        
      let nextClosed = prevClosed
      if (newlyClosed.length > 0) {
        nextClosed = [...newlyClosed, ...prevClosed]
        if (nextClosed.length > 500) {
          nextClosed = nextClosed.slice(0, 500)
        }
      }

      set({
        activeConnections: newActive,
        closedConnections: nextClosed,
        connectionCount: newActive.length,
        loading: false
      })
    }

    const handleMemory = (_e: unknown, info: ControllerMemory): void => {
      if (info && typeof info.inuse === 'number') {
        set({ memory: info.inuse })
      }
    }

    // Register Listeners (registerHandlers handles cleanup of old ones)
    registerHandlers(handleConnections, handleMemory)
  },

  cleanupListeners: () => {
    unregisterHandlers()
  },

  closeConnection: (_id: string) => {
    // 保持空实现，连接页当前直接调用 IPC / 本地状态更新。
    // 这里后续若要再次收敛到 store，需要配合运行时验证逐步迁移。
  },

  trashClosedConnection: (id: string) => {
    set(state => ({
        closedConnections: state.closedConnections.filter(c => c.id !== id)
    }))
  },

  closeAllConnections: () => {
    // 保持空实现，连接页当前直接调用 IPC / 本地状态更新。
  },
  
  trashAllClosedConnections: () => {
    set({ closedConnections: [] })
  }
}))

// Helper for listener management
let currentConnectionHandler: ((e: unknown, info: ControllerConnections) => void) | null = null
let currentMemoryHandler: ((e: unknown, info: ControllerMemory) => void) | null = null
let currentConnectionUnsubscribe: (() => void) | null = null
let currentMemoryUnsubscribe: (() => void) | null = null

function registerHandlers(
    connHandler: (e: unknown, info: ControllerConnections) => void,
    memHandler: (e: unknown, info: ControllerMemory) => void
) {
    unregisterHandlers()
    currentConnectionHandler = connHandler
    currentMemoryHandler = memHandler
    currentConnectionUnsubscribe = onIpc(ON.mihomoConnections, currentConnectionHandler)
    currentMemoryUnsubscribe = onIpc(ON.mihomoMemory, currentMemoryHandler)
}

function unregisterHandlers() {
    if (currentConnectionHandler) {
        currentConnectionUnsubscribe?.()
        currentConnectionUnsubscribe = null
        currentConnectionHandler = null
    }
    if (currentMemoryHandler) {
        currentMemoryUnsubscribe?.()
        currentMemoryUnsubscribe = null
        currentMemoryHandler = null
    }
}
