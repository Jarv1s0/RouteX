import { create } from 'zustand'
import { ON, onIpc } from '@renderer/utils/ipc-channels'
import {
  mihomoCloseAllConnections,
  mihomoCloseConnection,
  mihomoConnections,
  onTauriBridgeConnectionsReady,
  retainTauriConnectionsBridge
} from '@renderer/utils/mihomo-ipc'

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
type ConnectionSpeedSample = {
  upload: number
  download: number
  at: number
}

const connectionSnapshotListeners = new Set<ConnectionSnapshotListener>()
let latestConnectionSnapshot: ControllerConnections | null = null
let unavailableRetryTimer: number | null = null
// 记录 bridge 已完成一次 connections WS 建立，连接页可借此判断是否需要补拉快照。
// 当 bridge 重启时会递增，使旧的待发 setTimeout 回调能被识别为过期。
let bridgeReadySeq = 0

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

function clearUnavailableRetryTimer(): void {
  if (unavailableRetryTimer === null) {
    return
  }

  window.clearTimeout(unavailableRetryTimer)
  unavailableRetryTimer = null
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
    let lastForegroundSnapshotAt = 0
    let isBaselineSnapshot = false
    let initialSnapshotFallbackTimer: number | null = null
    const speedSamples = new Map<string, ConnectionSpeedSample>()

    const handleConnections = (_e: unknown, info: ControllerConnections): void => {
      if (!info || !info.connections) return

      // 先把解析后的连接快照广播出去，供其他 store 复用，避免重复监听和重复 JSON.parse。
      emitConnectionSnapshot(info)

      const now = Date.now()
      const updateSpeedSamples = (): void => {
        const activeIds = new Set<string>()
        info.connections?.forEach((connection) => {
          activeIds.add(connection.id)
          speedSamples.set(connection.id, {
            upload: Math.max(0, connection.upload || 0),
            download: Math.max(0, connection.download || 0),
            at: now
          })
        })

        speedSamples.forEach((_sample, id) => {
          if (!activeIds.has(id)) {
            speedSamples.delete(id)
          }
        })
      }

      const { isPaused } = get()
      if (isPaused) {
        updateSpeedSamples()
        return
      }
      // 窗口不可见时跳过列表衍生计算，降低后台 CPU 占用
      if (document.hidden) {
        updateSpeedSamples()
        return
      }

      const isBaseline = isBaselineSnapshot
      if (isBaseline) {
        isBaselineSnapshot = false
      }

      const { activeConnections: prevActive, closedConnections: prevClosed } = get()
      const prevActiveMap = new Map(prevActive.map((c) => [c.id, c]))

      const newActive: ExtendedConnection[] = info.connections.map((conn) => {
        const prev = prevActiveMap.get(conn.id)
        const previousSample = speedSamples.get(conn.id)
        const elapsedMs = previousSample ? Math.max(1, now - previousSample.at) : 0
        const downloadSpeed =
          previousSample && !isBaseline
            ? Math.round(
                (Math.max(0, conn.download - previousSample.download) * 1000) / elapsedMs
              )
            : prev?.downloadSpeed || 0
        const uploadSpeed =
          previousSample && !isBaseline
            ? Math.round((Math.max(0, conn.upload - previousSample.upload) * 1000) / elapsedMs)
            : prev?.uploadSpeed || 0

        // Enhance metadata if needed (e.g. for Inner type)
        const metadata =
          conn.metadata.type === 'Inner'
            ? { ...conn.metadata, process: 'mihomo', processPath: 'mihomo' }
            : conn.metadata

        const prevMetadata = prev?.metadata
        const metadataChanged =
          !prevMetadata ||
          prevMetadata.process !== metadata.process ||
          prevMetadata.processPath !== metadata.processPath ||
          prevMetadata.host !== metadata.host ||
          prevMetadata.destinationIP !== metadata.destinationIP ||
          prevMetadata.remoteDestination !== metadata.remoteDestination ||
          prevMetadata.sniffHost !== metadata.sniffHost ||
          prevMetadata.sourceIP !== metadata.sourceIP ||
          prevMetadata.sourcePort !== metadata.sourcePort ||
          prevMetadata.destinationPort !== metadata.destinationPort ||
          prevMetadata.type !== metadata.type ||
          prevMetadata.network !== metadata.network ||
          prevMetadata.inboundName !== metadata.inboundName ||
          prevMetadata.inboundUser !== metadata.inboundUser

        if (
          prev &&
          !metadataChanged &&
          prev.upload === conn.upload &&
          prev.download === conn.download &&
          prev.chains?.[0] === conn.chains?.[0] &&
          // 比较 rule 等可能会变的参数，如果没变就复用
          prev.rule === conn.rule &&
          prev.start === conn.start
        ) {
          if (
            downloadSpeed === 0 &&
            uploadSpeed === 0 &&
            prev.downloadSpeed === 0 &&
            prev.uploadSpeed === 0
          ) {
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

      updateSpeedSamples()

      // Identify newly closed connections
      // Connections that were in prevActive but are NOT in newActive
      const newActiveIds = new Set(newActive.map((c) => c.id))
      const newlyClosed = prevActive
        .filter((c) => !newActiveIds.has(c.id))
        .map((c) => ({
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

    const scheduleConnectionsSnapshotRetry = (): void => {
      if (unavailableRetryTimer !== null || document.hidden) {
        return
      }

      unavailableRetryTimer = window.setTimeout(() => {
        unavailableRetryTimer = null
        fetchConnectionsSnapshot()
      }, 1200)
    }

    const fetchConnectionsSnapshot = (preserveSpeedBaseline = false): void => {
      void mihomoConnections()
        .then((snapshot) => {
          clearUnavailableRetryTimer()
          bridgeReadySeq += 1

          if (preserveSpeedBaseline) {
            // 标记本次为基线快照：handleConnections 会设 lastSnapshotAt=now，
            // 但不参与速度派生，保证下一帧 WS 推送能正常计算速度差。
            isBaselineSnapshot = true
          }

          handleConnections(undefined, snapshot)
        })
        .catch((error) => {
          if (isExpectedMihomoUnavailableError(error)) {
            const previousSnapshot = latestConnectionSnapshot
            set({
              loading:
                !previousSnapshot ||
                !Array.isArray(previousSnapshot.connections) ||
                previousSnapshot.connections.length === 0
            })

            scheduleConnectionsSnapshotRetry()
            return
          }

          clearUnavailableRetryTimer()
        })
    }

    const handleCoreStarted = (): void => {
      scheduleConnectionsSnapshotRetry()
      fetchConnectionsSnapshot(true)
    }

    const handleVisibilityChange = (): void => {
      if (!document.hidden) {
        scheduleConnectionsSnapshotRetry()
        fetchConnectionsSnapshot(true)
      }
    }

    const handleWindowFocus = (): void => {
      if (document.hidden) {
        return
      }

      const now = Date.now()
      if (now - lastForegroundSnapshotAt < 300) {
        return
      }

      lastForegroundSnapshotAt = now
      fetchConnectionsSnapshot(true)
    }

    // Register Listeners (registerHandlers handles cleanup of old ones)
    registerHandlers(
      handleConnections,
      handleMemory,
      handleCoreStarted,
      handleVisibilityChange,
      handleWindowFocus
    )

    // 页面需要完整连接快照时才保留 connections bridge，离开页面后释放。
    // bridge 真正收到第一条消息后补拉一次快照，兜住 dev 重启/TUN 切换窗口期。
    const releaseConnectionsBridge = retainTauriConnectionsBridge()
    const cancelBridgeReady = onTauriBridgeConnectionsReady(() => {
      fetchConnectionsSnapshot(true)
    })

    const initialBridgeSeq = bridgeReadySeq
    initialSnapshotFallbackTimer = window.setTimeout(() => {
      initialSnapshotFallbackTimer = null
      if (bridgeReadySeq !== initialBridgeSeq || document.hidden) {
        return
      }
      fetchConnectionsSnapshot(true)
    }, 1500)

    // 进入连接/统计相关页面时主动拉一次当前快照，避免只等待后续增量事件导致首屏空白。
    fetchConnectionsSnapshot(true)

    const previousCleanup = get().cleanupListeners
    set({
      cleanupListeners: () => {
        releaseConnectionsBridge()
        cancelBridgeReady()
        if (initialSnapshotFallbackTimer !== null) {
          window.clearTimeout(initialSnapshotFallbackTimer)
          initialSnapshotFallbackTimer = null
        }
        previousCleanup()
      }
    })
  },

  cleanupListeners: () => {
    unregisterHandlers()
  },

  closeConnection: (id: string) => {
    void mihomoCloseConnection(id)
  },

  trashClosedConnection: (id: string) => {
    set((state) => ({
      closedConnections: state.closedConnections.filter((c) => c.id !== id)
    }))
  },

  closeAllConnections: () => {
    void mihomoCloseAllConnections()
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
let currentCoreStartedUnsubscribe: (() => void) | null = null
let currentVisibilityChangeHandler: (() => void) | null = null
let currentWindowFocusHandler: (() => void) | null = null

function registerHandlers(
  connHandler: (e: unknown, info: ControllerConnections) => void,
  memHandler: (e: unknown, info: ControllerMemory) => void,
  coreStartedHandler: () => void,
  visibilityChangeHandler: () => void,
  windowFocusHandler: () => void
) {
  unregisterHandlers()
  currentConnectionHandler = connHandler
  currentMemoryHandler = memHandler
  currentConnectionUnsubscribe = onIpc(ON.mihomoConnections, currentConnectionHandler)
  currentMemoryUnsubscribe = onIpc(ON.mihomoMemory, currentMemoryHandler)
  currentCoreStartedUnsubscribe = onIpc(ON.coreStarted, coreStartedHandler)
  currentVisibilityChangeHandler = visibilityChangeHandler
  currentWindowFocusHandler = windowFocusHandler
  document.addEventListener('visibilitychange', currentVisibilityChangeHandler)
  window.addEventListener('focus', currentWindowFocusHandler)
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
  currentCoreStartedUnsubscribe?.()
  currentCoreStartedUnsubscribe = null
  if (currentVisibilityChangeHandler) {
    document.removeEventListener('visibilitychange', currentVisibilityChangeHandler)
    currentVisibilityChangeHandler = null
  }
  if (currentWindowFocusHandler) {
    window.removeEventListener('focus', currentWindowFocusHandler)
    currentWindowFocusHandler = null
  }
  clearUnavailableRetryTimer()
}
