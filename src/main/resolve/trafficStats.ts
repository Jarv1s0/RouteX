import { dataDir } from '../utils/dirs'
import fs from 'fs'
import path from 'path'

interface HourlyStats {
  hour: string // 格式: "2024-01-15-14" (年-月-日-时)
  upload: number
  download: number
}

interface DailyStats {
  date: string // 格式: "2024-01-15"
  upload: number
  download: number
}

interface ProcessStats {
  process: string
  host: string  // 目标主机/域名
  upload: number
  download: number
}

interface TrafficStatsData {
  hourly: HourlyStats[] // 保留最近7天的小时数据
  daily: DailyStats[] // 保留最近30天的日数据
  lastUpdate: number
  sessionUpload: number
  sessionDownload: number
}

// 进程流量统计（内存中，不持久化）
interface ProcessTrafficData {
  sessionProcessStats: Map<string, ProcessStats> // 本次会话进程流量
  todayProcessStats: Map<string, ProcessStats> // 今日进程流量
  todayDate: string // 今日日期，用于判断是否需要重置
}

const STATS_FILE = 'traffic-stats.json'
const MAX_HOURLY_RECORDS = 24 * 7 // 7天的小时数据
const MAX_DAILY_RECORDS = 30 // 30天的日数据

let statsData: TrafficStatsData = {
  hourly: [],
  daily: [],
  lastUpdate: Date.now(),
  sessionUpload: 0,
  sessionDownload: 0
}

// 进程流量统计数据
let processTrafficData: ProcessTrafficData = {
  sessionProcessStats: new Map(),
  todayProcessStats: new Map(),
  todayDate: new Date().toISOString().split('T')[0]
}

// 连接流量追踪（用于计算增量）
const connectionTraffic: Map<string, { upload: number; download: number; process: string; host: string }> = new Map()

let lastUpload = 0
let lastDownload = 0
let saveTimer: NodeJS.Timeout | null = null

function getStatsFilePath(): string {
  return path.join(dataDir(), STATS_FILE)
}

export function loadTrafficStats(): TrafficStatsData {
  try {
    const filePath = getStatsFilePath()
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8')
      statsData = JSON.parse(data)
      // 重置会话数据
      statsData.sessionUpload = 0
      statsData.sessionDownload = 0
    }
  } catch (e) {
    console.error('Failed to load traffic stats:', e)
  }
  return statsData
}

export function saveTrafficStats(): void {
  try {
    const filePath = getStatsFilePath()
    fs.writeFileSync(filePath, JSON.stringify(statsData, null, 2))
  } catch (e) {
    console.error('Failed to save traffic stats:', e)
  }
}

function getCurrentHourKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}`
}

function getCurrentDateKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function updateTrafficStats(upload: number, download: number): void {
  // 计算增量
  const uploadDelta = upload > lastUpload ? upload - lastUpload : upload
  const downloadDelta = download > lastDownload ? download - lastDownload : download
  
  lastUpload = upload
  lastDownload = download

  // 更新会话数据
  statsData.sessionUpload += uploadDelta
  statsData.sessionDownload += downloadDelta

  // 更新小时数据
  const hourKey = getCurrentHourKey()
  let hourlyRecord = statsData.hourly.find(h => h.hour === hourKey)
  if (!hourlyRecord) {
    hourlyRecord = { hour: hourKey, upload: 0, download: 0 }
    statsData.hourly.push(hourlyRecord)
    // 清理旧数据
    if (statsData.hourly.length > MAX_HOURLY_RECORDS) {
      statsData.hourly = statsData.hourly.slice(-MAX_HOURLY_RECORDS)
    }
  }
  hourlyRecord.upload += uploadDelta
  hourlyRecord.download += downloadDelta

  // 更新日数据
  const dateKey = getCurrentDateKey()
  let dailyRecord = statsData.daily.find(d => d.date === dateKey)
  if (!dailyRecord) {
    dailyRecord = { date: dateKey, upload: 0, download: 0 }
    statsData.daily.push(dailyRecord)
    // 清理旧数据
    if (statsData.daily.length > MAX_DAILY_RECORDS) {
      statsData.daily = statsData.daily.slice(-MAX_DAILY_RECORDS)
    }
  }
  dailyRecord.upload += uploadDelta
  dailyRecord.download += downloadDelta

  statsData.lastUpdate = Date.now()

  // 延迟保存，避免频繁写入
  if (saveTimer) {
    clearTimeout(saveTimer)
  }
  saveTimer = setTimeout(() => {
    saveTrafficStats()
  }, 5000) // 5秒后保存
}

export function getTrafficStats(): TrafficStatsData {
  return statsData
}

export function resetSessionStats(): void {
  statsData.sessionUpload = 0
  statsData.sessionDownload = 0
  lastUpload = 0
  lastDownload = 0
}

export function clearTrafficStats(): void {
  statsData = {
    hourly: [],
    daily: [],
    lastUpdate: Date.now(),
    sessionUpload: 0,
    sessionDownload: 0
  }
  lastUpload = 0
  lastDownload = 0
  // 同时清除进程流量统计
  processTrafficData = {
    sessionProcessStats: new Map(),
    todayProcessStats: new Map(),
    todayDate: new Date().toISOString().split('T')[0]
  }
  connectionTraffic.clear()
  saveTrafficStats()
}

// 更新进程流量统计（从连接数据）
export function updateProcessTraffic(connections: Array<{
  id: string
  upload: number
  download: number
  metadata: {
    process?: string
    host?: string
    destinationIP?: string
  }
}>): void {
  const today = new Date().toISOString().split('T')[0]
  
  // 检查是否跨天，需要重置今日统计
  if (today !== processTrafficData.todayDate) {
    processTrafficData.todayProcessStats.clear()
    processTrafficData.todayDate = today
  }

  for (const conn of connections) {
    const process = conn.metadata?.process || '未知进程'
    const host = conn.metadata?.host || conn.metadata?.destinationIP || ''
    if (!process || process === '-') continue

    const prevTraffic = connectionTraffic.get(conn.id)
    const currentUpload = conn.upload
    const currentDownload = conn.download

    let uploadDelta = 0
    let downloadDelta = 0

    if (prevTraffic) {
      // 计算增量
      uploadDelta = Math.max(0, currentUpload - prevTraffic.upload)
      downloadDelta = Math.max(0, currentDownload - prevTraffic.download)
    } else {
      // 新连接，记录当前值作为基准（不计入增量，避免重复计算）
      uploadDelta = 0
      downloadDelta = 0
    }

    // 更新连接追踪
    connectionTraffic.set(conn.id, { upload: currentUpload, download: currentDownload, process, host })

    if (uploadDelta > 0 || downloadDelta > 0) {
      // 更新本次会话进程统计
      const sessionStats = processTrafficData.sessionProcessStats.get(process) || { process, host, upload: 0, download: 0 }
      sessionStats.upload += uploadDelta
      sessionStats.download += downloadDelta
      // 保留最新的 host（或者可以保留流量最大的 host）
      if (host) sessionStats.host = host
      processTrafficData.sessionProcessStats.set(process, sessionStats)

      // 更新今日进程统计
      const todayStats = processTrafficData.todayProcessStats.get(process) || { process, host, upload: 0, download: 0 }
      todayStats.upload += uploadDelta
      todayStats.download += downloadDelta
      if (host) todayStats.host = host
      processTrafficData.todayProcessStats.set(process, todayStats)
    }
  }

  // 清理已关闭的连接（可选，防止内存泄漏）
  const activeIds = new Set(connections.map(c => c.id))
  for (const id of connectionTraffic.keys()) {
    if (!activeIds.has(id)) {
      connectionTraffic.delete(id)
    }
  }
}

// 获取进程流量排行
export function getProcessTrafficRanking(type: 'session' | 'today', sortBy: 'upload' | 'download'): ProcessStats[] {
  const statsMap = type === 'session' 
    ? processTrafficData.sessionProcessStats 
    : processTrafficData.todayProcessStats

  const stats = Array.from(statsMap.values())
  
  // 按指定字段排序
  stats.sort((a, b) => b[sortBy] - a[sortBy])
  
  // 返回前10
  return stats.slice(0, 10)
}
