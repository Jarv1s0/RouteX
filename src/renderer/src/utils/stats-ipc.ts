import { C, invokeRaw, invokeTyped } from './ipc-core'
import type { TrafficStats } from '../../../shared/ipc-contract'

let trafficStatsPromise: Promise<TrafficStats> | null = null
let lastTrafficStatsAt = 0
let lastTrafficStatsResult: TrafficStats | null = null
let trafficStatsGeneration = 0

const TRAFFIC_STATS_CACHE_MS = 1000

export async function getTrafficStats(): Promise<TrafficStats> {
  const now = Date.now()
  if (lastTrafficStatsResult && now - lastTrafficStatsAt < TRAFFIC_STATS_CACHE_MS) {
    return lastTrafficStatsResult
  }

  if (trafficStatsPromise) {
    return trafficStatsPromise
  }

  const generation = trafficStatsGeneration
  const request = invokeTyped(C.getTrafficStats)
    .then((result) => {
      if (generation === trafficStatsGeneration) {
        lastTrafficStatsAt = Date.now()
        lastTrafficStatsResult = result
      }
      return result
    })
    .finally(() => {
      if (trafficStatsPromise === request) trafficStatsPromise = null
    })

  trafficStatsPromise = request
  return request
}

export async function clearTrafficStats(): Promise<void> {
  await invokeTyped(C.clearTrafficStats)
  trafficStatsGeneration += 1
  trafficStatsPromise = null
  lastTrafficStatsAt = 0
  lastTrafficStatsResult = null
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
