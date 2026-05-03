import { C, invokeRaw } from './ipc-core'

let trafficStatsPromise: Promise<{
  hourly: { hour: string; upload: number; download: number }[]
  daily: { date: string; upload: number; download: number }[]
  lastUpdate: number
  sessionUpload: number
  sessionDownload: number
}> | null = null
let lastTrafficStatsAt = 0
let lastTrafficStatsResult:
  | {
      hourly: { hour: string; upload: number; download: number }[]
      daily: { date: string; upload: number; download: number }[]
      lastUpdate: number
      sessionUpload: number
      sessionDownload: number
    }
  | null = null

const TRAFFIC_STATS_CACHE_MS = 1000

export async function getTrafficStats(): Promise<{
  hourly: { hour: string; upload: number; download: number }[]
  daily: { date: string; upload: number; download: number }[]
  lastUpdate: number
  sessionUpload: number
  sessionDownload: number
}> {
  const now = Date.now()
  if (lastTrafficStatsResult && now - lastTrafficStatsAt < TRAFFIC_STATS_CACHE_MS) {
    return lastTrafficStatsResult
  }

  if (trafficStatsPromise) {
    return trafficStatsPromise
  }

  trafficStatsPromise = invokeRaw<{
    hourly: { hour: string; upload: number; download: number }[]
    daily: { date: string; upload: number; download: number }[]
    lastUpdate: number
    sessionUpload: number
    sessionDownload: number
  }>(C.getTrafficStats)
    .then((result) => {
      lastTrafficStatsAt = Date.now()
      lastTrafficStatsResult = result
      return result
    })
    .finally(() => {
      trafficStatsPromise = null
    })

  return trafficStatsPromise
}

export async function clearTrafficStats(): Promise<void> {
  lastTrafficStatsAt = 0
  lastTrafficStatsResult = null
  return invokeRaw(C.clearTrafficStats)
}

export async function startNetworkHealthMonitor(): Promise<void> {
  return invokeRaw(C.startNetworkHealthMonitor)
}

export async function stopNetworkHealthMonitor(): Promise<void> {
  return invokeRaw(C.stopNetworkHealthMonitor)
}

export async function getNetworkHealthStats(): Promise<{
  currentLatency: number
  currentDnsLatency: number
  avgLatency: number
  maxLatency: number
  minLatency: number
  jitter: number
  packetLoss: number
  uptime: number
  testCount: number
  failCount: number
}> {
  return invokeRaw(C.getNetworkHealthStats)
}

export async function getAppUptime(): Promise<number> {
  return invokeRaw(C.getAppUptime)
}
