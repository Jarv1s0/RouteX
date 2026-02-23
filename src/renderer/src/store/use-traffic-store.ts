import { create } from 'zustand'
import { getTrafficStats, getProviderStats, getProfileConfig, triggerProviderSnapshot, startMonitor } from '@renderer/utils/ipc'

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
  currentProviders: string[]
  
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
  refreshProviderStats: () => Promise<void>
  clearStats: () => void
}

// Keep track of processed connection IDs to avoid double counting
const processedConnIds = new Set<string>()
const MAX_DATA_POINTS = 60
const MAX_DETAILS_PER_RULE = 20
const MAX_RULES_TRACKED = 1000

// Module-level interval reference
let trafficStatsInterval: number | undefined

// Module-level handler references for robust cleanup
let currentTrafficHandler: ((e: unknown, traffic: { up: number; down: number }) => void) | null = null
let currentConnectionsHandler: ((e: unknown, data: { connections?: Array<any> }) => void) | null = null

function unregisterTrafficHandlers() {
    if (currentTrafficHandler) {
        window.electron.ipcRenderer.removeListener('mihomoTraffic', currentTrafficHandler)
        currentTrafficHandler = null
    }
    if (currentConnectionsHandler) {
        window.electron.ipcRenderer.removeListener('mihomoConnections', currentConnectionsHandler)
        currentConnectionsHandler = null
    }
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
    // Attempt to start monitor (legacy behavior restoration)
    startMonitor().catch(() => {})

    // Clean up any existing listeners first using stored references
    unregisterTrafficHandlers()

    if (trafficStatsInterval) {
        clearInterval(trafficStatsInterval)
        trafficStatsInterval = undefined
    }

    // Traffic Listener Definition
    const handleTraffic = (_e: unknown, traffic: { up: number; down: number }): void => {
      const now = new Date()
      // Format time as HH:mm:ss
      const timeStr = now.toTimeString().split(' ')[0]
      
      set(state => {
        const newPoint: TrafficDataPoint = {
          time: timeStr,
          upload: traffic.up,
          download: traffic.down
        }
        // Keep last MAX_DATA_POINTS
        const updated = [...state.trafficHistory, newPoint].slice(-MAX_DATA_POINTS)
        
        // Accumulate session stats reasonably (though backend has true total)
        const newSession = {
            upload: state.sessionStats.upload + (traffic.up || 0),
            download: state.sessionStats.download + (traffic.down || 0)
        }

        return { 
          trafficHistory: updated,
          sessionStats: newSession
        }
      })
    }

    // Connections Listener Definition
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleConnections = (_e: unknown, data: { connections?: Array<any> }): void => {
      const connections = data.connections || []
      // Pre-calculate time string once
      const timeStr = new Date().toTimeString().split(' ')[0]

      set(state => {
        const newStats = new Map(state.ruleStats)
        const newDetails = new Map(state.ruleHitDetails)
        let hasChanges = false

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        connections.forEach((conn: any) => {
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
        const currentIds = new Set(connections.map((c: any) => c.id))
        if (processedConnIds.size > 5000) {
            for (const id of processedConnIds) {
                if (!currentIds.has(id)) {
                    processedConnIds.delete(id)
                }
            }
        }

        return hasChanges ? { ruleStats: newStats, ruleHitDetails: newDetails } : {}
      })
    }

    // Register Listeners
    try {
        currentTrafficHandler = handleTraffic
        currentConnectionsHandler = handleConnections
        window.electron.ipcRenderer.on('mihomoTraffic', handleTraffic)
        window.electron.ipcRenderer.on('mihomoConnections', handleConnections)
    } catch(e) {
        console.error('Failed to register listeners:', e)
    }

    // Initial fetch of static stats
    get().fetchInitialStats()

    // Start polling for static stats
     
    trafficStatsInterval = setInterval(() => {
        get().fetchInitialStats()
    }, 15000) as any
  },

  cleanupListeners: () => {
    unregisterTrafficHandlers()
    
    if (trafficStatsInterval) {
        clearInterval(trafficStatsInterval)
        trafficStatsInterval = undefined
    }
  },

  fetchInitialStats: async () => {
      try {
        const stats = await getTrafficStats()
        const pStats = await getProviderStats()
        const profileConfig = await getProfileConfig()
        
        const providers = (profileConfig.items || [])
          .filter(item => item.extra)
          .map(item => item.name || item.id)

        set({
            hourlyData: (stats.hourly || []).slice(-24),
            dailyData: (stats.daily || []).slice(-30),
            sessionStats: { upload: stats.sessionUpload, download: stats.sessionDownload },
            providerData: pStats.snapshots || [],
            currentProviders: providers
        })
      } catch (e) {
          console.error('Failed to fetch initial stats', e)
      }
  },

  refreshProviderStats: async () => {
    try {
      const pStats = await triggerProviderSnapshot()
      const profileConfig = await getProfileConfig()
      const providers = (profileConfig.items || [])
        .filter(item => item.extra)
        .map(item => item.name || item.id)
        
      set({
          providerData: pStats.snapshots || [],
          currentProviders: providers
      })
    } catch (e) {
      console.error('Failed to refresh provider stats', e)
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
      processedConnIds.clear()
  }
}))
