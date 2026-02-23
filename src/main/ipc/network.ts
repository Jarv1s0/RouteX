import { ipcMain, net } from 'electron'
import { mihomoGetConnections, mihomoCloseConnection, mihomoDnsQuery } from '../core/mihomoApi'
import { ipcErrorWrapper } from '../utils/ipc'

// 流媒体解锁检测
export interface StreamingResult {
  status: 'unlocked' | 'locked' | 'error'
  region?: string
  error?: string
}

export async function checkStreamingService(service: string): Promise<StreamingResult> {
  const timeout = 15000
  try {
    switch (service) {
      case 'netflix': return await checkNetflix(timeout)
      case 'disney': return await checkDisney(timeout)
      case 'youtube': return await checkYouTube(timeout)
      case 'spotify': return await checkSpotify(timeout)
      case 'chatgpt': return await checkChatGPT(timeout)
      case 'gemini': return await checkGemini(timeout)
      case 'tiktok': return await checkTikTok(timeout)
      default: return { status: 'error', error: '未知服务' }
    }
  } catch (e) {
    return { status: 'error', error: e instanceof Error ? e.message : String(e) }
  }
}

export async function httpGet(url: string, timeout: number): Promise<{ status: number; data: string; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    try {
      const request = net.request({ url, method: 'GET', redirect: 'follow' })
      let resolved = false
      let data = ''
      
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true
          try { request.abort() } catch { /* ignore */ }
          reject(new Error('请求超时'))
        }
      }, timeout)
      
      request.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
      request.setHeader('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')
      request.setHeader('Accept-Language', 'en-US,en;q=0.5')
      
      request.on('response', (response) => {
        const headers: Record<string, string> = {}
        Object.entries(response.headers).forEach(([key, value]) => {
          headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value || ''
        })
        
        let totalLength = 0
        const MAX_LENGTH = 150000
        
        response.on('data', (chunk) => {
          if (totalLength < MAX_LENGTH) {
            data += chunk.toString()
            totalLength += chunk.length
            if (totalLength >= MAX_LENGTH) {
              if (!resolved) {
                resolved = true
                clearTimeout(timer)
                resolve({ status: response.statusCode, data, headers })
              }
              try { request.abort() } catch { /* ignore */ }
            }
          }
        })
        response.on('end', () => {
          if (!resolved) {
            resolved = true
            clearTimeout(timer)
            resolve({ status: response.statusCode, data, headers })
          }
        })
        response.on('error', (error) => {
          if (!resolved) {
            resolved = true
            clearTimeout(timer)
            reject(error)
          }
        })
      })
      
      request.on('error', (error) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timer)
          reject(error)
        }
      })
      
      request.end()
    } catch (e) {
      reject(e)
    }
  })
}

async function checkNetflix(timeout: number): Promise<StreamingResult> {
  try {
    const res = await httpGet('https://www.netflix.com/title/80018499', timeout)
    if (res.status === 200) {
      const regionMatch = res.data.match(/"countryCode":"([A-Z]{2})"/)
      return { status: 'unlocked', region: regionMatch ? regionMatch[1] : 'Unknown' }
    } else if (res.status === 404) {
      const res2 = await httpGet('https://www.netflix.com/title/70143836', timeout)
      if (res2.status === 200) {
        return { status: 'unlocked', region: '仅自制剧' }
      }
      return { status: 'locked' }
    }
    return { status: 'locked' }
  } catch (e) {
    return { status: 'error', error: e instanceof Error ? e.message : String(e) }
  }
}

async function checkDisney(timeout: number): Promise<StreamingResult> {
  try {
    const res = await httpGet('https://www.disneyplus.com/', timeout)
    if (res.status === 200) {
      if (res.data.includes('unavailable') || res.data.includes('not-available')) {
        return { status: 'locked' }
      }
      const regionMatch = res.data.match(/"region":"([A-Z]{2})"/) || res.data.match(/data-location="([A-Z]{2})"/)
      return { status: 'unlocked', region: regionMatch ? regionMatch[1] : 'Unknown' }
    }
    return { status: 'locked' }
  } catch (e) {
    return { status: 'error', error: e instanceof Error ? e.message : String(e) }
  }
}

async function checkYouTube(timeout: number): Promise<StreamingResult> {
  try {
    const res = await httpGet('https://www.youtube.com/premium', timeout)
    if (res.status === 200) {
      const regionMatch = res.data.match(/"GL":"([A-Z]{2})"/) || res.data.match(/"INNERTUBE_CONTEXT_GL":"([A-Z]{2})"/)
      return { status: 'unlocked', region: regionMatch ? regionMatch[1] : 'Unknown' }
    }
    return { status: 'locked' }
  } catch (e) {
    return { status: 'error', error: e instanceof Error ? e.message : String(e) }
  }
}

async function checkSpotify(timeout: number): Promise<StreamingResult> {
  try {
    const res = await httpGet('https://open.spotify.com/', timeout)
    if (res.status === 200) {
      return { status: 'unlocked', region: 'Available' }
    }
    return { status: 'locked' }
  } catch (e) {
    return { status: 'error', error: e instanceof Error ? e.message : String(e) }
  }
}

async function checkChatGPT(timeout: number): Promise<StreamingResult> {
  try {
    const res = await httpGet('https://ios.chat.openai.com/', timeout)
    if (res.status === 200 || res.status === 302 || res.status === 301) {
      return { status: 'unlocked', region: 'Available' }
    } else if (res.status === 403) {
      if (res.data.includes('blocked') || res.data.includes('unavailable') || res.data.includes('VPN')) {
        return { status: 'locked' }
      }
    }
    const res2 = await httpGet('https://api.openai.com/v1/models', timeout)
    if (res2.status === 401) {
      return { status: 'unlocked', region: 'Available' }
    } else if (res2.status === 403) {
      return { status: 'locked' }
    }
    return { status: 'unlocked', region: 'Available' }
  } catch (e) {
    return { status: 'error', error: e instanceof Error ? e.message : String(e) }
  }
}

async function checkTikTok(timeout: number): Promise<StreamingResult> {
  try {
    const res = await httpGet('https://www.tiktok.com/', timeout)
    if (res.status === 200) {
      if (res.data.includes('not available') || res.data.includes('unavailable')) {
        return { status: 'locked' }
      }
      return { status: 'unlocked', region: 'Available' }
    }
    return { status: 'locked' }
  } catch (e) {
    return { status: 'error', error: e instanceof Error ? e.message : String(e) }
  }
}

async function checkGemini(timeout: number): Promise<StreamingResult> {
  try {
    const res = await httpGet('https://gemini.google.com/', timeout)
    if (res.status === 200) {
      if (res.data.includes('not available') || res.data.includes('unavailable') || res.data.includes('not supported')) {
        return { status: 'locked' }
      }
      return { status: 'unlocked', region: 'Available' }
    } else if (res.status === 403) {
      return { status: 'locked' }
    }
    return { status: 'unlocked', region: 'Available' }
  } catch (e) {
    return { status: 'error', error: e instanceof Error ? e.message : String(e) }
  }
}

async function findConnectionByHost(domain: string): Promise<{ rule: string; rulePayload: string; proxy: string } | null> {
  try {
    const connections = await mihomoGetConnections()
    if (!connections?.connections) return null
    const conn = connections.connections.find(c => 
      c.metadata?.host?.toLowerCase() === domain.toLowerCase() ||
      c.metadata?.host?.toLowerCase().endsWith('.' + domain.toLowerCase())
    )
    if (conn) {
      try {
        await mihomoCloseConnection(conn.id)
      } catch { /* ignore */ }
      return {
        rule: conn.rule || '',
        rulePayload: conn.rulePayload || '',
        proxy: conn.chains?.[0] || ''
      }
    }
    return null
  } catch {
    return null
  }
}

const resolveToIp = async (query: string): Promise<string> => {
  try {
    const net = await import('net')
    if (net.isIP(query) !== 0) return query
    const dns = await import('dns')
    const { address } = await dns.promises.lookup(query)
    return address
  } catch {
    return query
  }
}

export function registerNetworkHandlers(): void {
  ipcMain.handle('fetchIpInfo', ipcErrorWrapper(async () => {
    return new Promise((resolve, reject) => {
      const request = net.request('http://ip-api.com/json/?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query')
      let data = ''
      request.on('response', (response) => {
        response.on('data', (chunk) => { data += chunk.toString() })
        response.on('end', () => {
          try { resolve(JSON.parse(data)) } catch { reject(new Error('解析失败')) }
        })
      })
      request.on('error', (error) => { reject(error) })
      request.end()
    })
  }))

  ipcMain.handle('fetchIpInfoQuery', ipcErrorWrapper(async (_e, query: string) => {
    const ip = await resolveToIp(query)
    return new Promise((resolve, reject) => {
      const request = net.request(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`)
      let data = ''
      request.on('response', (response) => {
        response.on('data', (chunk) => { data += chunk.toString() })
        response.on('end', () => {
          try {
            const json = JSON.parse(data)
            if (json.query !== query) json.query = query 
            resolve(json)
          } catch { reject(new Error('解析失败')) }
        })
      })
      request.on('error', (error) => { reject(error) })
      request.end()
    })
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ipcMain.handle('fetchBatchIpInfo', ipcErrorWrapper(async (_e, queries: any[]) => {
    const resolvedQueries = await Promise.all(queries.map(async (q) => {
        if (q.query) {
            const ip = await resolveToIp(q.query)
            return { ...q, query: ip, originalQuery: q.query }
        }
        return q
    }))

    return new Promise((resolve, reject) => {
      try {
        const request = net.request({ url: 'http://ip-api.com/batch', method: 'POST' })
        request.setHeader('Content-Type', 'application/json')
        request.write(JSON.stringify(resolvedQueries))
        
        let data = ''
        request.on('response', (response) => {
          response.on('data', (chunk) => { data += chunk.toString() })
          response.on('end', () => {
            try {
              const json = JSON.parse(data)
              if (Array.isArray(json)) {
                  json.forEach((item, index) => {
                      if (resolvedQueries[index].originalQuery) {
                          item.query = resolvedQueries[index].originalQuery
                      }
                  })
              }
              resolve(json)
            } catch { reject(new Error('解析失败')) }
          })
        })
        request.on('error', (error) => { reject(error) })
        request.end()
      } catch (e) {
        reject(e)
      }
    })
  }))

  ipcMain.handle('testRuleMatch', async (_e, domain: string) => {
    try {
      return await new Promise((resolve) => {
        const url = `http://${domain}/`
        const resolveResult = async () => {
            try {
                await new Promise(r => setTimeout(r, 500))
                const result = await findConnectionByHost(domain)
                resolve(result)
            } catch (e) {
                resolve(null)
            }
        }

        try {
            const request = net.request({ url, method: 'HEAD' })
            const timeout = setTimeout(() => {
              try { request.abort() } catch { /* ignore */ }
              resolveResult()
            }, 3000)
            request.on('response', () => {
              clearTimeout(timeout)
              try { request.abort() } catch { /* ignore */ }
              resolveResult()
            })
            request.on('error', () => {
              clearTimeout(timeout)
              resolveResult()
            })
            request.end()
        } catch (e) {
            resolveResult()
        }
      })
    } catch (e) {
      return { invokeError: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('testConnectivity', async (_e, url: string, timeout: number = 5000) => {
    try {
      return await new Promise((resolve) => {
        const startTime = Date.now()
        const request = net.request({ url, method: 'GET' })
        
        const timer = setTimeout(() => {
          request.abort()
          resolve({ success: false, latency: -1, error: '超时' })
        }, timeout)
        
        request.on('response', (response) => {
          clearTimeout(timer)
          const latency = Date.now() - startTime
          request.abort()
          resolve({ success: response.statusCode < 400, latency, status: response.statusCode })
        })
        
        request.on('error', (error) => {
          clearTimeout(timer)
          resolve({ success: false, latency: -1, error: error.message })
        })
        
        request.end()
      })
    } catch (e) {
      return { success: false, latency: -1, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('httpGet', async (_e, url: string, timeout: number = 5000) => {
    try {
      return await httpGet(url, timeout)
    } catch (e) {
      return { status: 500, data: '', headers: {}, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('checkStreamingUnlock', async (_e, service: string) => {
    try {
      return await checkStreamingService(service)
    } catch (e) {
      return { status: 'error', region: '', error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('testDNSLatency', async (_e, domain: string) => {
    const start = Date.now()
    try {
      await mihomoDnsQuery(domain, 'A')
      return Math.max(1, Date.now() - start)
    } catch {
      try {
        const dns = await import('dns')
        await dns.promises.resolve(domain)
        return Math.max(1, Date.now() - start)
      } catch {
        return -1
      }
    }
  })
}
