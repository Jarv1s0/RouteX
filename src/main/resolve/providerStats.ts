import { dataDir } from '../utils/dirs'
import fs from 'fs'
import path from 'path'
import { mihomoProxyProviders } from '../core/mihomoApi'

interface DailySnapshot {
  date: string // 格式: "2024-01-15"
  provider: string // provider name
  used: number // 当天记录的累计已用流量
}

interface ProviderStatsData {
  snapshots: DailySnapshot[]
  lastUpdate: number
}

const STATS_FILE = 'provider-stats.json'
const MAX_DAYS = 90 // 保留90天数据

let statsData: ProviderStatsData = {
  snapshots: [],
  lastUpdate: Date.now()
}

let snapshotTimer: NodeJS.Timeout | null = null

function getStatsFilePath(): string {
  return path.join(dataDir(), STATS_FILE)
}

export function loadProviderStats(): ProviderStatsData {
  try {
    const filePath = getStatsFilePath()
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8')
      statsData = JSON.parse(data)
    }
  } catch (e) {
    console.error('Failed to load provider stats:', e)
  }
  return statsData
}

export function saveProviderStats(): void {
  try {
    const filePath = getStatsFilePath()
    fs.writeFileSync(filePath, JSON.stringify(statsData, null, 2))
  } catch (e) {
    console.error('Failed to save provider stats:', e)
  }
}

function getCurrentDateKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

// 记录当天的订阅流量快照
async function takeSnapshot(): Promise<void> {
  try {
    const providers = await mihomoProxyProviders()
    const dateKey = getCurrentDateKey()
    
    for (const [providerName, provider] of Object.entries(providers.providers)) {
      if (providerName === 'default') continue
      if (!provider.subscriptionInfo) continue
      
      const used = provider.subscriptionInfo.Upload + provider.subscriptionInfo.Download
      const displayName = provider.name || providerName
      
      // 查找或创建今天的快照
      let snapshot = statsData.snapshots.find(
        s => s.date === dateKey && s.provider === displayName
      )
      
      if (!snapshot) {
        snapshot = { date: dateKey, provider: displayName, used: 0 }
        statsData.snapshots.push(snapshot)
      }
      
      // 更新为最新值
      snapshot.used = used
    }
    
    statsData.lastUpdate = Date.now()
    
    // 清理超过90天的数据
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - MAX_DAYS)
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0]
    statsData.snapshots = statsData.snapshots.filter(s => s.date >= cutoffDateStr)
    
    saveProviderStats()
  } catch {
    // ignore
  }
}

export function startMapUpdateTimer(): void {
  // 立即记录一次
  takeSnapshot()
  
  // 每小时记录一次
  if (snapshotTimer) {
    clearInterval(snapshotTimer)
  }
  snapshotTimer = setInterval(() => {
    takeSnapshot()
  }, 60 * 60 * 1000) // 1小时
}

export function stopMapUpdateTimer(): void {
  if (snapshotTimer) {
    clearInterval(snapshotTimer)
    snapshotTimer = null
  }
}

export function getProviderStats(): ProviderStatsData {
  return statsData
}

export function clearProviderStats(): void {
  statsData = {
    snapshots: [],
    lastUpdate: Date.now()
  }
  saveProviderStats()
}
