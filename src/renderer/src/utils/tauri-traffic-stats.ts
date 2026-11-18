import { onTauriRealtimeTraffic } from './mihomo-ipc'

export interface TauriTrafficHistoryPoint {
  time: string
  upload: number
  download: number
}

const MAX_RECENT_TRAFFIC_POINTS = 60

let recentTrafficPoints: TauriTrafficHistoryPoint[] = []
let trafficRecorderUnsubscribe: (() => void) | null = null

function isTauriHost(): boolean {
  return __ROUTEX_HOST__ === 'tauri'
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

export function ensureTauriTrafficRecorder(): void {
  if (!isTauriHost() || trafficRecorderUnsubscribe) {
    return
  }

  trafficRecorderUnsubscribe = onTauriRealtimeTraffic((info) => {
    const normalized = normalizeTraffic(info)
    pushRecentTrafficPoint(normalized)
  })
}

export function getRecentTauriTrafficPoints(): TauriTrafficHistoryPoint[] {
  return recentTrafficPoints.slice()
}

export function resetTauriTrafficRecorder(): void {
  recentTrafficPoints = []
}
