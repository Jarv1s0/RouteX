import { create } from 'zustand'
import throttle from 'lodash/throttle'

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

export const useConnectionsStore = create<ConnectionsState>((set, get) => ({
  activeConnections: [],
  closedConnections: [],
  connectionCount: 0,
  loading: true,
  memory: 0,
  isPaused: false,

  setPaused: (paused: boolean) => set({ isPaused: paused }),

  initializeListeners: () => {
    const handleConnections = throttle((_e: unknown, info: ControllerConnections): void => {
      const { isPaused } = get()
      if (isPaused) return
      
      if (!info || !info.connections) return
      
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
          prev.rule === conn.rule &&
          prev.start === conn.start
        ) {
           // We still need to update speed to 0 if we calculate it locally, 
           // but here we calculate distinct speed based on diff.
           // Actually, if upload/download didn't change, speed is 0.
           // And if prev was active, and now active, and traffic same -> speed 0.
           // So if prev had speed 0, we can reuse it?
           // The computed speed depends on the diff.
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
      
      // Merge with existing closed list and limit size
      let nextClosed = [...newlyClosed, ...prevClosed]
      if (nextClosed.length > 500) {
        nextClosed = nextClosed.slice(0, 500)
      }

      set({
        activeConnections: newActive,
        closedConnections: nextClosed,
        connectionCount: newActive.length,
        loading: false
      })
    }, 1000, { leading: true, trailing: true })

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
    // Optimistic update?
    // Real logic is IPC call, allowing the backend to push update.
    // But for "Closed" tab, we manage it locally.
    // Actually, `connections.tsx` called IPC for active, local state for closed.
    // We will handle that in the UI component or here?
    // The previous component had `mihomoCloseConnection`.
    // Let's keep side-effects (IPC calls) here for clean component.
    // But wait, for active connections we call IPC.
    // For closed connections, we just remove from history.
    // We need to know which list it is in? 
    // ID should be unique.
  },

  trashClosedConnection: (id: string) => {
    set(state => ({
        closedConnections: state.closedConnections.filter(c => c.id !== id)
    }))
  },

  closeAllConnections: () => {
     // IPC call for active?
  },
  
  trashAllClosedConnections: () => {
    set({ closedConnections: [] })
  }
}))

// Helper for listener management
let currentConnectionHandler: ((e: unknown, info: ControllerConnections) => void) | null = null
let currentMemoryHandler: ((e: unknown, info: ControllerMemory) => void) | null = null

function registerHandlers(
    connHandler: (e: unknown, info: ControllerConnections) => void,
    memHandler: (e: unknown, info: ControllerMemory) => void
) {
    unregisterHandlers()
    currentConnectionHandler = connHandler
    currentMemoryHandler = memHandler
    window.electron.ipcRenderer.on('mihomoConnections', currentConnectionHandler)
    window.electron.ipcRenderer.on('mihomoMemory', currentMemoryHandler)
}

function unregisterHandlers() {
    if (currentConnectionHandler) {
        window.electron.ipcRenderer.removeListener('mihomoConnections', currentConnectionHandler)
        currentConnectionHandler = null
    }
    if (currentMemoryHandler) {
        window.electron.ipcRenderer.removeListener('mihomoMemory', currentMemoryHandler)
        currentMemoryHandler = null
    }
}
