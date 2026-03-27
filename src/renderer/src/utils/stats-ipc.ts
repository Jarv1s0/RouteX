import { C, invokeRaw } from './ipc-core'

export async function getTrafficStats(): Promise<{
  hourly: { hour: string; upload: number; download: number }[]
  daily: { date: string; upload: number; download: number }[]
  lastUpdate: number
  sessionUpload: number
  sessionDownload: number
}> {
  return invokeRaw(C.getTrafficStats)
}

export async function getProviderStats(): Promise<{
  snapshots: { date: string; provider: string; used: number }[]
  lastUpdate: number
}> {
  return invokeRaw(C.getProviderStats)
}

export async function clearTrafficStats(): Promise<void> {
  return invokeRaw(C.clearTrafficStats)
}

export async function getProcessTrafficRanking(
  type: 'session' | 'today',
  sortBy: 'upload' | 'download'
): Promise<
  {
    process: string
    host: string
    upload: number
    download: number
  }[]
> {
  return invokeRaw(C.getProcessTrafficRanking, type, sortBy)
}

export async function clearProviderStats(): Promise<void> {
  return invokeRaw(C.clearProviderStats)
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

export async function getAppMemory(): Promise<number> {
  return invokeRaw(C.getAppMemory)
}

export async function testDNSLatency(domain = 'google.com'): Promise<number> {
  return invokeRaw(C.testDNSLatency, domain)
}
