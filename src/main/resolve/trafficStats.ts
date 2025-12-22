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

interface TrafficStatsData {
  hourly: HourlyStats[] // 保留最近7天的小时数据
  daily: DailyStats[] // 保留最近30天的日数据
  lastUpdate: number
  sessionUpload: number
  sessionDownload: number
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
  saveTrafficStats()
}
