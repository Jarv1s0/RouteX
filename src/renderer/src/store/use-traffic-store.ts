import { create } from 'zustand'
import { getTrafficStats } from '@renderer/utils/stats-ipc'
import {
  getRecentTauriTrafficPoints,
  resetTauriTrafficRecorder
} from '@renderer/utils/tauri-traffic-stats'
import { subscribeDesktopTraffic } from '@renderer/utils/mihomo-ipc'
import throttle from '@renderer/utils/throttle'
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
  routeStats: { proxy: number; direct: number }

  // Rule Stats
  ruleStats: Map<string, { hits: number; upload: number; download: number }>
  ruleHitDetails: Map<
    string,
    Array<{
      id: string
      time: string
      host: string
      process: string
      proxy: string
      upload: number
      download: number
    }>
  >

  // Actions
  initializeListeners: () => void
  cleanupListeners: () => void
  fetchInitialStats: () => Promise<void>
  clearStats: () => void
}

// Keep track of processed connection IDs to avoid double counting
const processedConnIds = new Set<string>()
const MAX_DATA_POINTS = 60
const MAX_DETAILS_PER_RULE = 10
const MAX_RULES_TRACKED = 500
const CONNECTION_SNAPSHOT_THROTTLE_MS = 1000
const HISTORICAL_STATS_REFRESH_INTERVAL_MS = 30_000

// Module-level interval reference
let trafficStatsInterval: number | undefined
// Module-level visibility change handler reference
let visibilityChangeHandler: (() => void) | null = null

// Module-level handler references for robust cleanup
let currentTrafficUnsubscribe: (() => void) | null = null
let currentConnectionsThrottle: { cancel: () => void } | null = null
let currentConnectionsUnsubscribe: (() => void) | null = null
let lastTrafficStatsUpdate = 0
let statsGeneration = 0
let routeTrafficConnectionSamples = new Map<
  string,
  { upload: number; download: number; isDirect: boolean }
>()

// 展示保留最新速率，会话累计值直接采用后端的字节计数。
let pendingTrafficRaf: number | null = null
let pendingTrafficDisplay: ControllerTraffic | null = null

function getTimeKey(): string {
  return new Date().toTimeString().split(' ')[0]
}

function clearTrafficStatsPolling() {
  if (!trafficStatsInterval) return
  clearInterval(trafficStatsInterval)
  trafficStatsInterval = undefined
}

function unregisterTrafficHandlers() {
  statsGeneration += 1
  currentConnectionsThrottle?.cancel()
  currentConnectionsThrottle = null
  currentConnectionsUnsubscribe?.()
  currentConnectionsUnsubscribe = null
  currentTrafficUnsubscribe?.()
  currentTrafficUnsubscribe = null
  if (visibilityChangeHandler) {
    document.removeEventListener('visibilitychange', visibilityChangeHandler)
    visibilityChangeHandler = null
  }
  if (pendingTrafficRaf !== null) {
    cancelAnimationFrame(pendingTrafficRaf)
    pendingTrafficRaf = null
  }
  pendingTrafficDisplay = null
  routeTrafficConnectionSamples.clear()
}

function isDirectConnection(conn: ControllerConnectionDetail): boolean {
  const currentOutbound = conn.chains?.[0]?.trim().toUpperCase()
  return !currentOutbound || currentOutbound === 'DIRECT'
}

function createEmptyRuleStats(): Pick<TrafficState, 'ruleStats' | 'ruleHitDetails'> {
  return {
    ruleStats: new Map(),
    ruleHitDetails: new Map()
  }
}

export const useTrafficStore = create<TrafficState>((set, get) => ({
  trafficHistory: [],
  hourlyData: [],
  dailyData: [],
  sessionStats: { upload: 0, download: 0 },
  routeStats: { proxy: 0, direct: 0 },
  ...createEmptyRuleStats(),

  initializeListeners: () => {
    // Clean up any existing listeners first using stored references
    unregisterTrafficHandlers()
    clearTrafficStatsPolling()

    const recentTrafficPoints = getRecentTauriTrafficPoints()
    if (recentTrafficPoints.length > 0 && get().trafficHistory.length === 0) {
      set({
        trafficHistory: recentTrafficPoints
      })
    }

    const handleTraffic = (traffic: ControllerTraffic): void => {
      pendingTrafficDisplay = traffic
      lastTrafficStatsUpdate = traffic.timestamp ?? Date.now()
      if (pendingTrafficRaf === null) {
        pendingTrafficRaf = requestAnimationFrame(() => {
          pendingTrafficRaf = null
          const sample = pendingTrafficDisplay
          pendingTrafficDisplay = null
          if (!sample) return
          set((state) => ({
            trafficHistory: [
              ...state.trafficHistory,
              {
                time: getTimeKey(),
                upload: Math.max(0, Math.trunc(sample.up || 0)),
                download: Math.max(0, Math.trunc(sample.down || 0))
              }
            ].slice(-MAX_DATA_POINTS),
            sessionStats: {
              upload: sample.sessionUpload ?? state.sessionStats.upload,
              download: sample.sessionDownload ?? state.sessionStats.download
            }
          }))
        })
      }
    }

    const handleConnections = throttle(
      (snapshot: ControllerConnections): void => {
        // 窗口不可见时跳过规则统计处理，降低 CPU 占用
        if (document.hidden) return

        const connections = snapshot.connections || []
        const timeStr = getTimeKey()
        set((state) => {
          let newStats: Map<string, { hits: number; upload: number; download: number }> | null =
            null
          let newDetails: TrafficState['ruleHitDetails'] | null = null
          const copiedStats = new Set<string>()
          const nextRouteSamples = new Map<
            string,
            { upload: number; download: number; isDirect: boolean }
          >()
          const routeDelta = { proxy: 0, direct: 0 }
          let hasChanges = false
          let hasDetailsChanges = false

          const getMutableRuleStats = (ruleName: string) => {
            newStats ??= new Map(state.ruleStats)
            let stats = newStats.get(ruleName)
            if (!stats) {
              stats = { hits: 0, upload: 0, download: 0 }
              newStats.set(ruleName, stats)
              copiedStats.add(ruleName)
            } else if (!copiedStats.has(ruleName)) {
              stats = { ...stats }
              newStats.set(ruleName, stats)
              copiedStats.add(ruleName)
            }
            return stats
          }

          connections.forEach((conn) => {
            const upload = Math.max(0, Math.trunc(conn.upload || 0))
            const download = Math.max(0, Math.trunc(conn.download || 0))
            const isDirect = isDirectConnection(conn)
            const previousRouteSample = routeTrafficConnectionSamples.get(conn.id)
            const uploadDelta = previousRouteSample
              ? Math.max(0, upload - previousRouteSample.upload)
              : upload
            const downloadDelta = previousRouteSample
              ? Math.max(0, download - previousRouteSample.download)
              : download
            const trafficDelta = uploadDelta + downloadDelta

            nextRouteSamples.set(conn.id, { upload, download, isDirect })

            if (trafficDelta > 0) {
              if (isDirect) {
                routeDelta.direct += trafficDelta
              } else {
                routeDelta.proxy += trafficDelta
              }
              hasChanges = true
            }

            if (!conn.rule) return

            const ruleName = conn.rulePayload ? `${conn.rule},${conn.rulePayload}` : conn.rule

            let existing = (newStats ?? state.ruleStats).get(ruleName)
            if (!existing) {
              existing = getMutableRuleStats(ruleName)
              hasChanges = true
            }

            if (!processedConnIds.has(conn.id)) {
              existing = getMutableRuleStats(ruleName)
              existing.hits += 1
              processedConnIds.add(conn.id)
              hasChanges = true
              hasDetailsChanges = true

              // Update Details
              newDetails ??= new Map(state.ruleHitDetails)
              const ruleDetails = [...(newDetails.get(ruleName) || [])]

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

            // Accumulate per-connection byte deltas so multi-connection rules reflect total traffic
            if (uploadDelta > 0 || downloadDelta > 0) {
              existing = getMutableRuleStats(ruleName)
              existing.upload += uploadDelta
              existing.download += downloadDelta
              hasChanges = true
            }
          })

          // Prevent massive state growth
          routeTrafficConnectionSamples = nextRouteSamples

          // LRU 淘汰：当规则数超过上限时，按命中次数从低到高排序，淘汰最不活跃的 20%
          if ((newStats ?? state.ruleStats).size > MAX_RULES_TRACKED) {
            newStats ??= new Map(state.ruleStats)
            newDetails ??= new Map(state.ruleHitDetails)
            const evictCount = Math.ceil(MAX_RULES_TRACKED * 0.2)
            const sorted = [...newStats.entries()].sort((a, b) => a[1].hits - b[1].hits)
            for (let i = 0; i < evictCount && i < sorted.length; i++) {
              const key = sorted[i][0]
              newStats.delete(key)
              newDetails.delete(key)
            }
            hasChanges = true
            hasDetailsChanges = true
          }

          // Garbage collect processedConnIds: remove IDs no longer in current connections
          for (const id of processedConnIds) {
            if (!nextRouteSamples.has(id)) {
              processedConnIds.delete(id)
            }
          }

          if (!hasChanges) {
            return {}
          }

          const updates: Partial<TrafficState> = {
            ruleStats: newStats ?? state.ruleStats,
            routeStats: {
              proxy: state.routeStats.proxy + routeDelta.proxy,
              direct: state.routeStats.direct + routeDelta.direct
            }
          }

          if (hasDetailsChanges) {
            updates.ruleHitDetails = newDetails ?? state.ruleHitDetails
          }

          return updates
        })
      },
      CONNECTION_SNAPSHOT_THROTTLE_MS,
      { leading: true, trailing: true }
    )

    // Register Listeners
    try {
      currentTrafficUnsubscribe = subscribeDesktopTraffic(handleTraffic)
      currentConnectionsThrottle = handleConnections
      currentConnectionsUnsubscribe = subscribeConnectionSnapshot(handleConnections)
    } catch (e) {
      console.error('Failed to register listeners:', e)
    }

    // Initial fetch of static stats
    void get().fetchInitialStats()
    const refreshVisibleStats = () => {
      if (!document.hidden) {
        void get().fetchInitialStats()
      }
    }

    // 实时速度走 /traffic 推送；小时/日历史数据低频补刷即可，避免统计页持续 IPC 压力。
    trafficStatsInterval = window.setInterval(
      refreshVisibleStats,
      HISTORICAL_STATS_REFRESH_INTERVAL_MS
    )

    // 当用户从后台切换回前台时，立即补刷一次（防止数据陈旧）
    visibilityChangeHandler = refreshVisibleStats
    document.addEventListener('visibilitychange', visibilityChangeHandler)
  },

  cleanupListeners: () => {
    unregisterTrafficHandlers()
    clearTrafficStatsPolling()
    processedConnIds.clear()
    set(createEmptyRuleStats())
  },

  fetchInitialStats: async () => {
    const generation = statsGeneration
    try {
      const stats = await getTrafficStats()
      if (generation !== statsGeneration) return

      set({
        hourlyData: (stats.hourly || []).slice(-24),
        dailyData: (stats.daily || []).slice(-30),
        ...(stats.lastUpdate >= lastTrafficStatsUpdate
          ? {
              sessionStats: { upload: stats.sessionUpload, download: stats.sessionDownload }
            }
          : {})
      })
    } catch (e) {
      console.error('Failed to fetch initial stats', e)
    }
  },

  clearStats: () => {
    statsGeneration += 1
    set({
      trafficHistory: [],
      hourlyData: [],
      dailyData: [],
      sessionStats: { upload: 0, download: 0 },
      routeStats: { proxy: 0, direct: 0 },
      ...createEmptyRuleStats()
    })
    pendingTrafficDisplay = null
    lastTrafficStatsUpdate = 0
    resetTauriTrafficRecorder()
    processedConnIds.clear()
    routeTrafficConnectionSamples.clear()
  }
}))
