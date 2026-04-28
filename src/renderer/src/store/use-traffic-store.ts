import { create } from 'zustand'
import { getProfileConfig } from '@renderer/utils/profile-ipc'
import { getProviderStats, getTrafficStats } from '@renderer/utils/stats-ipc'
import {
  getRecentTauriTrafficPoints,
  resetTauriTrafficRecorder
} from '@renderer/utils/tauri-traffic-stats'
import { subscribeDesktopTraffic } from '@renderer/utils/mihomo-ipc'
import { ON, onIpc } from '@renderer/utils/ipc-channels'
import throttle from 'lodash/throttle'
import { subscribeConnectionSnapshot } from './use-connections-store'

interface TrafficDataPoint {
  time: string
  upload: number
  download: number
}

interface TrafficState {
  trafficHistory: TrafficDataPoint[]
  hourlyData: { hour: string; upload: number; download: number }[]
  dailyData: { date: string; upload: number; download: number }[]
  sessionStats: { upload: number; download: number }
  
  // Provider Data
  providerData: { date: string; provider: string; used: number }[]
  currentProviders: { name: string; resetDay?: number }[]
  
  // Rule Stats
  ruleStats: Map<string, { hits: number; upload: number; download: number }>
  ruleHitDetails: Map<string, Array<{
    id: string
    time: string
    host: string
    process: string
    proxy: string
    upload: number
    download: number
  }>>

  // Actions
  initializeListeners: () => void
  cleanupListeners: () => void
  fetchInitialStats: () => Promise<void>
  refreshCurrentProviders: () => Promise<void>
  clearStats: () => void
}

// Keep track of processed connection IDs to avoid double counting
const processedConnIds = new Set<string>()
const MAX_DATA_POINTS = 60
const MAX_DETAILS_PER_RULE = 20
const MAX_RULES_TRACKED = 1000
const TRAFFIC_EVENT_STALE_MS = 900
const CONNECTION_SNAPSHOT_THROTTLE_MS = 250

// Module-level interval reference
let trafficStatsInterval: number | undefined
// Module-level visibility change handler reference
let visibilityChangeHandler: (() => void) | null = null

// Module-level handler references for robust cleanup
let currentTrafficUnsubscribe: (() => void) | null = null
let currentConnectionsThrottle: { cancel: () => void } | null = null
let currentConnectionsUnsubscribe: (() => void) | null = null
let currentProfileConfigUnsubscribe: (() => void) | null = null
let lastIpcTrafficEventAt = 0
let lastIpcTrafficSample: { up: number; down: number; at: number } | null = null
let lastConnectionTotals: { upload: number; download: number; at: number } | null = null

function getTimeKey(): string {
  return new Date().toTimeString().split(' ')[0]
}

function clearTrafficStatsPolling() {
  if (!trafficStatsInterval) return
  clearInterval(trafficStatsInterval)
  trafficStatsInterval = undefined
}

function unregisterTrafficHandlers() {
    currentConnectionsThrottle?.cancel()
    currentConnectionsThrottle = null
    currentConnectionsUnsubscribe?.()
    currentConnectionsUnsubscribe = null
    currentTrafficUnsubscribe?.()
    currentTrafficUnsubscribe = null
    currentProfileConfigUnsubscribe?.()
    currentProfileConfigUnsubscribe = null
    if (visibilityChangeHandler) {
        document.removeEventListener('visibilitychange', visibilityChangeHandler)
        visibilityChangeHandler = null
    }
    lastIpcTrafficEventAt = 0
    lastIpcTrafficSample = null
    lastConnectionTotals = null
}

export const useTrafficStore = create<TrafficState>((set, get) => ({
  trafficHistory: [],
  hourlyData: [],
  dailyData: [],
  sessionStats: { upload: 0, download: 0 },
  providerData: [],
  currentProviders: [],
  ruleStats: new Map(),
  ruleHitDetails: new Map(),

  initializeListeners: () => {
    // Clean up any existing listeners first using stored references
    unregisterTrafficHandlers()
    clearTrafficStatsPolling()

    // Traffic Listener Definition
    const applyTrafficSample = (
      displayTraffic: { up: number; down: number },
      trafficDelta = displayTraffic
    ): void => {
      const normalizedDisplay = {
        up: Math.max(0, Math.trunc(displayTraffic.up || 0)),
        down: Math.max(0, Math.trunc(displayTraffic.down || 0))
      }
      const normalizedDelta = {
        up: Math.max(0, Math.trunc(trafficDelta.up || 0)),
        down: Math.max(0, Math.trunc(trafficDelta.down || 0))
      }
      const timeStr = getTimeKey()

      set(state => {
        const newPoint: TrafficDataPoint = {
          time: timeStr,
          upload: normalizedDisplay.up,
          download: normalizedDisplay.down
        }
        const updated = [...state.trafficHistory, newPoint].slice(-MAX_DATA_POINTS)

        return {
          trafficHistory: updated,
          sessionStats: {
            upload: state.sessionStats.upload + normalizedDelta.up,
            download: state.sessionStats.download + normalizedDelta.down
          }
        }
      })
    }

    const recentTrafficPoints = getRecentTauriTrafficPoints()
    if (recentTrafficPoints.length > 0 && get().trafficHistory.length === 0) {
      set({
        trafficHistory: recentTrafficPoints
      })
    }

    const handleTraffic = (traffic: { up: number; down: number }): void => {
      lastIpcTrafficEventAt = Date.now()
      lastIpcTrafficSample = {
        up: Math.max(0, Math.trunc(traffic.up || 0)),
        down: Math.max(0, Math.trunc(traffic.down || 0)),
        at: lastIpcTrafficEventAt
      }
      applyTrafficSample(traffic, traffic)
    }

    const handleConnections = throttle((snapshot: ControllerConnections): void => {
      // 窗口不可见时跳过规则统计处理，降低 CPU 占用
      if (document.hidden) return

      const connections = snapshot.connections || []
      const timeStr = getTimeKey()
      const now = Date.now()
      const uploadTotal = Math.max(0, Math.trunc(snapshot.uploadTotal || 0))
      const downloadTotal = Math.max(0, Math.trunc(snapshot.downloadTotal || 0))
      const previousTotals = lastConnectionTotals
      lastConnectionTotals = { upload: uploadTotal, download: downloadTotal, at: now }

      if (previousTotals && now - lastIpcTrafficEventAt > TRAFFIC_EVENT_STALE_MS) {
        const uploadDelta = Math.max(0, uploadTotal - previousTotals.upload)
        const downloadDelta = Math.max(0, downloadTotal - previousTotals.download)

        if (uploadDelta > 0 || downloadDelta > 0) {
          const elapsedMs = Math.max(1, now - previousTotals.at)
          applyTrafficSample(
            {
              up: Math.trunc((uploadDelta * 1000) / elapsedMs),
              down: Math.trunc((downloadDelta * 1000) / elapsedMs)
            },
            {
              up: uploadDelta,
              down: downloadDelta
            }
          )
        }
      } else if (previousTotals && lastIpcTrafficSample) {
        const uploadDelta = Math.max(0, uploadTotal - previousTotals.upload)
        const downloadDelta = Math.max(0, downloadTotal - previousTotals.download)
        const ipcSampleLooksStuck =
          lastIpcTrafficSample.up === 0 &&
          lastIpcTrafficSample.down === 0 &&
          now - lastIpcTrafficSample.at <= TRAFFIC_EVENT_STALE_MS

        if (ipcSampleLooksStuck && (uploadDelta > 0 || downloadDelta > 0)) {
          const elapsedMs = Math.max(1, now - previousTotals.at)
          applyTrafficSample(
            {
              up: Math.trunc((uploadDelta * 1000) / elapsedMs),
              down: Math.trunc((downloadDelta * 1000) / elapsedMs)
            },
            {
              up: uploadDelta,
              down: downloadDelta
            }
          )
        }
      }

      set(state => {
        const newStats = new Map(state.ruleStats)
        const newDetails = new Map(state.ruleHitDetails)
        let hasChanges = false

        connections.forEach((conn) => {
          if (!conn.rule) return
          
          const ruleName = conn.rulePayload 
            ? `${conn.rule},${conn.rulePayload}` 
            : conn.rule
          
          let existing = newStats.get(ruleName)
          if (!existing) {
            existing = { hits: 0, upload: 0, download: 0 }
            newStats.set(ruleName, existing)
            hasChanges = true
          }
          
          if (!processedConnIds.has(conn.id)) {
            existing.hits += 1
            processedConnIds.add(conn.id)
            hasChanges = true
            
            // Update Details
            const ruleDetails = newDetails.get(ruleName) || []
            
            // Limit tracked rules count
            if (newDetails.size >= MAX_RULES_TRACKED && !newDetails.has(ruleName)) {
                 const firstKey = newDetails.keys().next().value
                 if (firstKey) newDetails.delete(firstKey)
            }

            // Add new detail to start
            ruleDetails.unshift({
                id: conn.id,
                time: timeStr,
                host: conn.metadata?.host || conn.metadata?.destinationIP || '-',
                process: conn.metadata?.process || '-',
                proxy: conn.chains?.length ? conn.chains[0] : 'DIRECT',
                upload: conn.upload,
                download: conn.download
            })
            
            if (ruleDetails.length > MAX_DETAILS_PER_RULE) {
                 newDetails.set(ruleName, ruleDetails.slice(0, MAX_DETAILS_PER_RULE))
            } else {
                 newDetails.set(ruleName, ruleDetails)
            }
          }
          
          // Update upload/download max
          if (conn.upload > existing.upload || conn.download > existing.download) {
             existing.upload = Math.max(existing.upload, conn.upload)
             existing.download = Math.max(existing.download, conn.download)
             hasChanges = true
          }
        })
        
        // Prevent massive state growth
        if (newStats.size > 2000) {
             return {}
        }
        
        // Garbage collect processedConnIds: remove IDs no longer in current connections
        const currentIds = new Set(connections.map((c: ControllerConnectionDetail) => c.id))
        for (const id of processedConnIds) {
            if (!currentIds.has(id)) {
                processedConnIds.delete(id)
            }
        }

        return hasChanges ? { ruleStats: newStats, ruleHitDetails: newDetails } : {}
      })
    }, CONNECTION_SNAPSHOT_THROTTLE_MS, { leading: true, trailing: true })

    // Register Listeners
    try {
        currentTrafficUnsubscribe = subscribeDesktopTraffic(handleTraffic)
        currentConnectionsThrottle = handleConnections
        currentConnectionsUnsubscribe = subscribeConnectionSnapshot(handleConnections)
        currentProfileConfigUnsubscribe = onIpc(ON.profileConfigUpdated, () => {
          void get().refreshCurrentProviders()
        })
    } catch(e) {
        console.error('Failed to register listeners:', e)
    }

    // Initial fetch of static stats
    void Promise.all([get().fetchInitialStats(), get().refreshCurrentProviders()])
    const refreshVisibleStats = () => {
      if (!document.hidden) {
        void get().fetchInitialStats()
      }
    }

    // 可见状态下每 5s 补刷一次历史数据，避免小时/日统计长时间滞后。
    // 并且只在窗口可见时才轮询，避免后台无效 IPC 消耗
    trafficStatsInterval = window.setInterval(refreshVisibleStats, 5000)

    // 当用户从后台切换回前台时，立即补刷一次（防止数据陈旧）
    visibilityChangeHandler = refreshVisibleStats
    document.addEventListener('visibilitychange', visibilityChangeHandler)
  },

  cleanupListeners: () => {
    unregisterTrafficHandlers()
    clearTrafficStatsPolling()
  },

  fetchInitialStats: async () => {
      try {
        // 并发请求，减少串行等待时间
        const [stats, pStats] = await Promise.all([
          getTrafficStats(),
          getProviderStats()
        ])

        set({
            hourlyData: (stats.hourly || []).slice(-24),
            dailyData: (stats.daily || []).slice(-30),
            sessionStats: { upload: stats.sessionUpload, download: stats.sessionDownload },
            providerData: pStats.snapshots || []
        })
      } catch (e) {
          console.error('Failed to fetch initial stats', e)
      }
  },

  refreshCurrentProviders: async () => {
      try {
        const profileConfig = await getProfileConfig()
        const providers = (profileConfig.items || [])
          .filter(item => item.extra)
          .map(item => ({ name: item.name || item.id, resetDay: item.resetDay }))

        set({ currentProviders: providers })
      } catch (e) {
          console.error('Failed to refresh current providers', e)
      }
  },

  clearStats: () => {
      set({
          trafficHistory: [],
          hourlyData: [],
          dailyData: [],
          sessionStats: { upload: 0, download: 0 },
          ruleStats: new Map(),
          ruleHitDetails: new Map()
      })
      resetTauriTrafficRecorder()
      processedConnIds.clear()
  }
}))
