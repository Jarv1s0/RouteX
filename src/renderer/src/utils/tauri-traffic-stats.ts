import { C, invokeRaw } from './ipc-core'
import { onTauriRealtimeTraffic } from './mihomo-ipc'

export interface TauriTrafficHistoryPoint {
  time: string
  upload: number
  download: number
}

const MAX_RECENT_TRAFFIC_POINTS = 60
const TRAFFIC_FLUSH_INTERVAL_MS = 500

let recentTrafficPoints: TauriTrafficHistoryPoint[] = []
let pendingTrafficDelta = { up: 0, down: 0 }
let pendingFlushTimer: number | null = null
let trafficRecorderUnsubscribe: (() => void) | null = null

function isTauriHost(): boolean {
  return __ROUTEX_HOST__ === 'tauri'
}

function getDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`
}

function getHourKey(date = new Date()): string {
  return `${getDateKey(date)}-${String(date.getHours()).padStart(2, '0')}`
}

function getTimeKey(date = new Date()): string {
  return date.toTimeString().split(' ')[0]
}

function normalizeTraffic(traffic: { up: number; down: number }): { up: number; down: number } {
  return {
    up: Math.max(0, Math.trunc(traffic.up || 0)),
    down: Math.max(0, Math.trunc(traffic.down || 0))
  }
}

function pushRecentTrafficPoint(traffic: { up: number; down: number }, now = new Date()): void {
  recentTrafficPoints = [
    ...recentTrafficPoints,
    {
      time: getTimeKey(now),
      upload: traffic.up,
      download: traffic.down
    }
  ].slice(-MAX_RECENT_TRAFFIC_POINTS)
}

function schedulePendingTrafficFlush(): void {
  if (pendingFlushTimer !== null) {
    return
  }

  pendingFlushTimer = window.setTimeout(() => {
    pendingFlushTimer = null
    void flushPendingTauriTrafficSample()
  }, TRAFFIC_FLUSH_INTERVAL_MS)
}

async function flushPendingTauriTrafficSample(): Promise<void> {
  if (!isTauriHost()) {
    pendingTrafficDelta = { up: 0, down: 0 }
    return
  }

  const delta = pendingTrafficDelta
  if (delta.up <= 0 && delta.down <= 0) {
    return
  }

  pendingTrafficDelta = { up: 0, down: 0 }

  try {
    await recordTauriTrafficSample(delta)
  } catch {
    pendingTrafficDelta = {
      up: pendingTrafficDelta.up + delta.up,
      down: pendingTrafficDelta.down + delta.down
    }
    schedulePendingTrafficFlush()
  }
}

export async function recordTauriTrafficSample(traffic: { up: number; down: number }): Promise<void> {
  if (!isTauriHost()) {
    return
  }

  const { up: upload, down: download } = normalizeTraffic(traffic)
  const now = new Date()

  await invokeRaw(C.recordTrafficSample, {
    up: upload,
    down: download,
    hour: getHourKey(now),
    date: getDateKey(now),
    timestamp: now.getTime()
  })
}

export function ensureTauriTrafficRecorder(): void {
  if (!isTauriHost() || trafficRecorderUnsubscribe) {
    return
  }

  trafficRecorderUnsubscribe = onTauriRealtimeTraffic((info) => {
    const normalized = normalizeTraffic(info)
    pushRecentTrafficPoint(normalized)
    pendingTrafficDelta = {
      up: pendingTrafficDelta.up + normalized.up,
      down: pendingTrafficDelta.down + normalized.down
    }
    schedulePendingTrafficFlush()
  })
}

export function getRecentTauriTrafficPoints(): TauriTrafficHistoryPoint[] {
  return recentTrafficPoints.slice()
}

export function resetTauriTrafficRecorder(): void {
  recentTrafficPoints = []
  pendingTrafficDelta = { up: 0, down: 0 }

  if (pendingFlushTimer !== null) {
    window.clearTimeout(pendingFlushTimer)
    pendingFlushTimer = null
  }
}
