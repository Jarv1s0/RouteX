import { net } from 'electron'
import { mainWindow } from '../index'

interface NetworkHealthData {
  currentLatency: number
  avgLatency: number
  maxLatency: number
  minLatency: number
  jitter: number
  packetLoss: number
  uptime: number
  testCount: number
  failCount: number
}

const MAX_HISTORY = 60
const TEST_INTERVAL = 15000 // 15秒

let latencyHistory: number[] = []
let testCount = 0
let failCount = 0
let intervalId: NodeJS.Timeout | null = null

async function testLatency(): Promise<number> {
  return new Promise((resolve) => {
    const startTime = Date.now()
    const request = net.request({
      method: 'HEAD',
      url: 'https://www.gstatic.com/generate_204'
    })
    
    const timeout = setTimeout(() => {
      request.abort()
      resolve(-1)
    }, 5000)
    
    request.on('response', () => {
      clearTimeout(timeout)
      resolve(Date.now() - startTime)
    })
    
    request.on('error', () => {
      clearTimeout(timeout)
      resolve(-1)
    })
    
    request.end()
  })
}

function calculateStats(): NetworkHealthData {
  const validLatencies = latencyHistory.filter(l => l > 0)
  
  const currentLatency = latencyHistory.length > 0 ? latencyHistory[latencyHistory.length - 1] : -1
  const avgLatency = validLatencies.length > 0 
    ? Math.round(validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length) 
    : 0
  const maxLatency = validLatencies.length > 0 ? Math.max(...validLatencies) : 0
  const minLatency = validLatencies.length > 0 ? Math.min(...validLatencies) : 0
  
  // 计算抖动
  let jitter = 0
  if (validLatencies.length >= 2) {
    let jitterSum = 0
    for (let i = 1; i < validLatencies.length; i++) {
      jitterSum += Math.abs(validLatencies[i] - validLatencies[i - 1])
    }
    jitter = Math.round(jitterSum / (validLatencies.length - 1))
  }
  
  const packetLoss = testCount > 0 ? Math.round((failCount / testCount) * 100) : 0
  const uptime = testCount > 0 ? Math.round(((testCount - failCount) / testCount) * 100 * 10) / 10 : 100
  
  return {
    currentLatency,
    avgLatency,
    maxLatency,
    minLatency,
    jitter,
    packetLoss,
    uptime,
    testCount,
    failCount
  }
}

async function runTest(): Promise<void> {
  const latency = await testLatency()
  testCount++
  
  if (latency < 0) {
    failCount++
    latencyHistory.push(0)
  } else {
    latencyHistory.push(latency)
  }
  
  // 保持历史记录在限制内
  if (latencyHistory.length > MAX_HISTORY) {
    latencyHistory = latencyHistory.slice(-MAX_HISTORY)
  }
  
  // 发送数据到渲染进程
  if (mainWindow) {
    mainWindow.webContents.send('networkHealth', calculateStats())
  }
}

export function startNetworkHealthMonitor(): void {
  if (intervalId) return
  
  // 立即执行一次
  runTest()
  
  // 定时执行
  intervalId = setInterval(runTest, TEST_INTERVAL)
}

export function stopNetworkHealthMonitor(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}

export function getNetworkHealthStats(): NetworkHealthData {
  return calculateStats()
}
