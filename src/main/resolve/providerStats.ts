import { dataDir } from '../utils/dirs'
import fs from 'fs'
import path from 'path'
import { mihomoProxyProviders } from '../core/mihomoApi'
import { getProfileConfig } from '../config/profile'

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

export async function loadProviderStats(): Promise<ProviderStatsData> {
  try {
    const filePath = getStatsFilePath()
    if (fs.existsSync(filePath)) {
      const data = await fs.promises.readFile(filePath, 'utf-8')
      const parsed = JSON.parse(data)
      // 兼容旧数据格式（daily -> snapshots）
      if (parsed.daily && !parsed.snapshots) {
        parsed.snapshots = parsed.daily
        delete parsed.daily
      }
      statsData = {
        snapshots: parsed.snapshots || [],
        lastUpdate: parsed.lastUpdate || Date.now()
      }
    }
  } catch (e) {
    console.error('Failed to load provider stats:', e)
  }
  return statsData
}

export async function saveProviderStats(): Promise<void> {
  try {
    const filePath = getStatsFilePath()
    await fs.promises.writeFile(filePath, JSON.stringify(statsData, null, 2))
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
    const dateKey = getCurrentDateKey()
    
    // 方式1: 从 Profile 配置中获取订阅信息
    const profileConfig = await getProfileConfig()
    const items = profileConfig.items || []
    
    for (const item of items) {
      if (!item.extra) {
        continue
      }
      
      const used = (item.extra.upload || 0) + (item.extra.download || 0)
      const displayName = item.name || item.id
      
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
    
    // 方式2: 从 proxy-providers API 获取（作为补充）
    try {
      const providers = await mihomoProxyProviders()
      for (const [providerName, provider] of Object.entries(providers.providers || {})) {
        if (providerName === 'default') continue
        
        const vehicleType = (provider as { vehicleType?: string }).vehicleType
        if (vehicleType === 'Compatible') continue
        if (!provider.subscriptionInfo) continue
        
        const used = provider.subscriptionInfo.Upload + provider.subscriptionInfo.Download
        const displayName = provider.name || providerName
        
        // 检查是否已经从 Profile 中记录过
        const existing = statsData.snapshots.find(
          s => s.date === dateKey && s.provider === displayName
        )
        if (existing) continue
        
        statsData.snapshots.push({ date: dateKey, provider: displayName, used })
      }
    } catch (e) {
      // API 获取失败，跳过
    }
    
    statsData.lastUpdate = Date.now()
    
    // 清理超过90天的数据
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - MAX_DAYS)
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0]
    statsData.snapshots = statsData.snapshots.filter(s => s.date >= cutoffDateStr)
    
    saveProviderStats()
  } catch (e) {
    console.error('[ProviderStats] 记录快照失败:', e)
  }
}

export function startMapUpdateTimer(): void {
  // 不立即记录，等待 core-started 事件
  // 每小时记录一次
  if (snapshotTimer) {
    clearInterval(snapshotTimer)
  }
  snapshotTimer = setInterval(() => {
    takeSnapshot()
  }, 60 * 60 * 1000) // 1小时
}

// 当 mihomo 内核启动完成后调用
export function onCoreStarted(): void {
  takeSnapshot()
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

// 手动触发快照记录
export async function triggerSnapshot(): Promise<void> {
  await takeSnapshot()
}

export function clearProviderStats(): void {
  statsData = {
    snapshots: [],
    lastUpdate: Date.now()
  }
  saveProviderStats()
}
