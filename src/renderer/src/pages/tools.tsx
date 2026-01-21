import React, { useState, useCallback, useEffect } from 'react'
import BasePage from '@renderer/components/base/base-page'
import { Card, CardBody, Input, Button, Tabs, Tab, Chip, Skeleton } from '@heroui/react'
import { IoSearch, IoGlobe, IoShield, IoWifi, IoCheckmarkCircle, IoCloseCircle, IoRefresh, IoLocation, IoEye, IoEyeOff, IoCopy, IoPlay } from 'react-icons/io5'
import { mihomoDnsQuery, testRuleMatch, testConnectivity, fetchIpInfo as fetchIpInfoIpc, checkStreamingUnlock } from '@renderer/utils/ipc'

import { CARD_STYLES } from '@renderer/utils/card-styles'

interface ConnectivityResult {
  name: string
  url: string
  icon: string
  success: boolean
  latency: number
  error?: string
  testing: boolean
}

interface IpInfo {
  ip: string
  country: string
  countryCode: string
  region: string
  city: string
  isp: string
  org: string
  as: string
  timezone: string
  lat: number
  lon: number
}

const defaultTargets = [
  { name: 'Google', url: 'https://www.google.com/generate_204', icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Google_Search.png' },
  { name: 'GitHub', url: 'https://github.com', icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/GitHub.png' },
  { name: 'YouTube', url: 'https://www.youtube.com', icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/YouTube.png' },
  { name: 'Cloudflare', url: 'https://1.1.1.1/cdn-cgi/trace', icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Cloudflare.png' },
  { name: '百度', url: 'https://www.baidu.com', icon: 'https://www.baidu.com/favicon.ico' }
]

interface StreamingService {
  key: string
  name: string
  icon: string
  status: 'idle' | 'testing' | 'unlocked' | 'locked' | 'error'
  region?: string
  error?: string
}

const defaultStreamingServices: StreamingService[] = [
  { key: 'chatgpt', name: 'ChatGPT', icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/ChatGPT.png', status: 'idle' },
  { key: 'gemini', name: 'Gemini', icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Google.png', status: 'idle' },
  { key: 'netflix', name: 'Netflix', icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Netflix.png', status: 'idle' },
  { key: 'youtube', name: 'YouTube', icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/YouTube.png', status: 'idle' },
  { key: 'spotify', name: 'Spotify', icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Spotify.png', status: 'idle' },
  { key: 'tiktok', name: 'TikTok', icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/TikTok.png', status: 'idle' }
]

const Tools: React.FC = () => {
  // DNS 查询
  const [dnsQuery, setDnsQuery] = useState('')
  const [dnsType, setDnsType] = useState<'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT'>('A')
  const [dnsResult, setDnsResult] = useState<string[]>([])
  const [dnsLoading, setDnsLoading] = useState(false)
  const [dnsError, setDnsError] = useState<string | null>(null)

  // 规则测试
  const [ruleQuery, setRuleQuery] = useState('')
  const [ruleResult, setRuleResult] = useState<{ rule: string; rulePayload: string; proxy: string } | null>(null)
  const [ruleLoading, setRuleLoading] = useState(false)
  const [ruleError, setRuleError] = useState<string | null>(null)

  // 连通性检测
  const [connectivityResults, setConnectivityResults] = useState<ConnectivityResult[]>(
    defaultTargets.map(t => ({ ...t, success: false, latency: -1, testing: false }))
  )
  const [allTesting, setAllTesting] = useState(false)

  // IP 信息
  const [ipInfo, setIpInfo] = useState<IpInfo | null>(null)
  const [ipLoading, setIpLoading] = useState(false)
  const [showIp, setShowIp] = useState(false)
  const [ipError, setIpError] = useState<string | null>(null)

  // 流媒体解锁检测
  const [streamingServices, setStreamingServices] = useState<StreamingService[]>(defaultStreamingServices)
  const [streamingAllTesting, setStreamingAllTesting] = useState(false)

  const handleDnsQuery = async (): Promise<void> => {
    if (!dnsQuery.trim()) return
    setDnsLoading(true)
    setDnsError(null)
    setDnsResult([])
    try {
      const result = await mihomoDnsQuery(dnsQuery.trim(), dnsType)
      if (result.Answer && result.Answer.length > 0) {
        setDnsResult(result.Answer.map(a => a.data))
      } else {
        setDnsError('无解析结果')
      }
    } catch (e) {
      setDnsError(String(e))
    } finally {
      setDnsLoading(false)
    }
  }

  const handleRuleTest = async (): Promise<void> => {
    if (!ruleQuery.trim()) return
    setRuleLoading(true)
    setRuleError(null)
    setRuleResult(null)
    try {
      const result = await testRuleMatch(ruleQuery.trim())
      if (result && result.rule) {
        setRuleResult(result)
      } else {
        setRuleError('未能获取规则匹配结果')
      }
    } catch (e) {
      setRuleError(String(e))
    } finally {
      setRuleLoading(false)
    }
  }

  const testSingleConnectivity = async (index: number): Promise<void> => {
    setConnectivityResults(prev => {
      const next = [...prev]
      next[index] = { ...next[index], testing: true }
      return next
    })
    
    const target = connectivityResults[index]
    const result = await testConnectivity(target.url, 5000)
    
    setConnectivityResults(prev => {
      const next = [...prev]
      next[index] = { 
        ...next[index], 
        success: result.success, 
        latency: result.latency,
        error: result.error,
        testing: false 
      }
      return next
    })
  }

  const testAllConnectivity = async (): Promise<void> => {
    setAllTesting(true)
    // 重置所有结果
    setConnectivityResults(prev => prev.map(r => ({ ...r, testing: true, success: false, latency: -1, error: undefined })))
    
    // 并行测试所有目标
    await Promise.all(
      connectivityResults.map(async (_, index) => {
        const target = defaultTargets[index]
        const result = await testConnectivity(target.url, 5000)
        setConnectivityResults(prev => {
          const next = [...prev]
          next[index] = { 
            ...next[index], 
            success: result.success, 
            latency: result.latency,
            error: result.error,
            testing: false 
          }
          return next
        })
      })
    )
    
    setAllTesting(false)
  }

  // 流媒体解锁检测
  const testSingleStreaming = async (index: number): Promise<void> => {
    setStreamingServices(prev => {
      const next = [...prev]
      next[index] = { ...next[index], status: 'testing', region: undefined, error: undefined }
      return next
    })
    
    try {
      const service = streamingServices[index]
      const result = await checkStreamingUnlock(service.key)
      
      setStreamingServices(prev => {
        const next = [...prev]
        next[index] = { 
          ...next[index], 
          status: result.status,
          region: result.region,
          error: result.error
        }
        return next
      })
    } catch (e) {
      setStreamingServices(prev => {
        const next = [...prev]
        next[index] = { 
          ...next[index], 
          status: 'error',
          error: e instanceof Error ? e.message : String(e)
        }
        return next
      })
    }
  }

  const testAllStreaming = async (): Promise<void> => {
    setStreamingAllTesting(true)
    // 重置所有结果
    setStreamingServices(prev => prev.map(s => ({ ...s, status: 'testing' as const, region: undefined, error: undefined })))
    
    // 并行测试所有服务
    await Promise.all(
      defaultStreamingServices.map(async (service, index) => {
        try {
          const result = await checkStreamingUnlock(service.key)
          setStreamingServices(prev => {
            const next = [...prev]
            next[index] = { 
              ...next[index], 
              status: result.status,
              region: result.region,
              error: result.error
            }
            return next
          })
        } catch (e) {
          setStreamingServices(prev => {
            const next = [...prev]
            next[index] = { 
              ...next[index], 
              status: 'error',
              error: e instanceof Error ? e.message : String(e)
            }
            return next
          })
        }
      })
    )
    
    setStreamingAllTesting(false)
  }

  // 获取 IP 信息
  const fetchIpInfo = useCallback(async () => {
    setIpLoading(true)
    setIpError(null)
    try {
      const data = await fetchIpInfoIpc()
      if (data.status === 'success') {
        setIpInfo({
          ip: data.query || '',
          country: data.country || '',
          countryCode: data.countryCode || '',
          region: data.regionName || '',
          city: data.city || '',
          isp: data.isp || '',
          org: data.org || '',
          as: data.as || '',
          timezone: data.timezone || '',
          lat: data.lat || 0,
          lon: data.lon || 0
        })
      } else {
        setIpError(data.message || '获取失败')
      }
    } catch {
      setIpError('网络错误')
    } finally {
      setIpLoading(false)
    }
  }, [])

  // 复制 IP 信息
  const copyIpInfo = useCallback(async () => {
    if (!ipInfo) return
    const info = `IP: ${ipInfo.ip}
国家/地区: ${ipInfo.country}
城市: ${ipInfo.city}, ${ipInfo.region}
时区: ${ipInfo.timezone}
ISP: ${ipInfo.isp}
ASN: ${ipInfo.as}`
    try {
      await navigator.clipboard.writeText(info)
    } catch {
      // 降级方案
      const textArea = document.createElement('textarea')
      textArea.value = info
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
    }
  }, [ipInfo])

  // 初始加载 IP 信息
  useEffect(() => {
    fetchIpInfo()
  }, [fetchIpInfo])

  return (
    <BasePage title="工具">
      <div className="p-2 space-y-2">
        {/* DNS 查询 & 规则测试 */}
        <div className="grid grid-cols-2 gap-2">
          {/* DNS 查询 */}
          <Card>
            <CardBody className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-primary/20">
                  <IoGlobe className="text-primary text-lg" />
                </div>
                <span className="font-medium">DNS 查询</span>
                <span className="text-foreground-400 text-xs">（A/AAAA/CNAME）</span>
              </div>
              
              <div className="flex items-center gap-2 mb-3">
                <Input
                  size="sm"
                  placeholder="输入域名，如 google.com"
                  value={dnsQuery}
                  onValueChange={setDnsQuery}
                  onKeyDown={(e) => e.key === 'Enter' && handleDnsQuery()}
                  className="flex-1"
                  classNames={CARD_STYLES.GLASS_INPUT}
                />
                <Tabs 
                  classNames={CARD_STYLES.GLASS_TABS}
                  selectedKey={dnsType} 
                  onSelectionChange={(key) => setDnsType(key as typeof dnsType)}
                >
                  <Tab key="A" title="A" />
                  <Tab key="AAAA" title="AAAA" />
                  <Tab key="CNAME" title="CNAME" />
                </Tabs>
                <Button
                  size="sm"
                  color="primary"
                  isLoading={dnsLoading}
                  onPress={handleDnsQuery}
                  isIconOnly
                >
                  <IoSearch />
                </Button>
              </div>

              {dnsError && (
                <div className="text-danger text-sm">{dnsError}</div>
              )}
              
              {dnsResult.length > 0 && (
                <div className="space-y-1">
                  {dnsResult.map((ip, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Chip size="sm" variant="flat" color="primary">{dnsType}</Chip>
                      <span className="font-mono text-sm">{ip}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* 规则测试 */}
          <Card>
            <CardBody className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-warning/20">
                  <IoShield className="text-warning text-lg" />
                </div>
                <span className="font-medium">规则测试</span>
                <span className="text-foreground-400 text-xs">（测试实际匹配规则）</span>
              </div>
              
              <div className="flex items-center gap-2 mb-3">
                <Input
                  size="sm"
                  placeholder="输入域名，如 google.com"
                  value={ruleQuery}
                  onValueChange={setRuleQuery}
                  onKeyDown={(e) => e.key === 'Enter' && handleRuleTest()}
                  className="flex-1"
                  classNames={CARD_STYLES.GLASS_INPUT}
                />
                <Button
                  size="sm"
                  color="warning"
                  isLoading={ruleLoading}
                  onPress={handleRuleTest}
                  isIconOnly
                >
                  <IoSearch />
                </Button>
              </div>

              {ruleError && (
                <div className="text-danger text-sm">{ruleError}</div>
              )}
              
              {ruleResult && (
                <div className="p-2 rounded-lg bg-content2 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground-400 text-sm">匹配规则:</span>
                    <span className="font-mono text-sm">{ruleResult.rule}{ruleResult.rulePayload ? `,${ruleResult.rulePayload}` : ''}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-foreground-400 text-sm">出站代理:</span>
                    <Chip size="sm" variant="flat" color="success">{ruleResult.proxy}</Chip>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* 连通性检测 */}
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-success/20">
                  <IoWifi className="text-success text-lg" />
                </div>
                <span className="font-medium">连通性检测</span>
              </div>
              <Button
                size="sm"
                color="success"
                variant="flat"
                isLoading={allTesting}
                onPress={testAllConnectivity}
                startContent={!allTesting && <IoRefresh />}
              >
                全部测试
              </Button>
            </div>
            
            <div className="grid grid-cols-5 gap-2">
              {connectivityResults.map((result, index) => (
                <Card 
                  key={result.name}
                  isPressable
                  onPress={() => !result.testing && testSingleConnectivity(index)}
                  className={`${CARD_STYLES.GLASS_ITEM_CARD} ${result.testing ? 'opacity-50 scale-95' : 'hover:scale-105'}`}
                >
                  <CardBody className="p-3 text-center">
                    <img 
                      src={result.icon} 
                      alt={result.name} 
                      className="w-6 h-6 mx-auto mb-1" 
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>'
                      }}
                    />
                    <div className="text-sm font-medium mb-2">{result.name}</div>
                    {result.testing ? (
                      <div className="text-primary text-xs animate-pulse">测试中...</div>
                    ) : result.latency >= 0 ? (
                      <div className="animate-in fade-in duration-200">
                        <div className="flex justify-center mb-1">
                          {result.success ? (
                            <IoCheckmarkCircle className="text-success text-xl animate-in zoom-in duration-200" />
                          ) : (
                            <IoCloseCircle className="text-danger text-xl animate-in zoom-in duration-200" />
                          )}
                        </div>
                        <div className={`text-xs ${result.success ? 'text-success' : 'text-danger'}`}>
                          {result.success ? `${result.latency}ms` : result.error || '失败'}
                        </div>
                      </div>
                    ) : (
                      <div className="text-primary text-xs">点击测试</div>
                    )}
                  </CardBody>
                </Card>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* 流媒体解锁检测 */}
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-secondary/20">
                  <IoPlay className="text-secondary text-lg" />
                </div>
                <span className="font-medium">流媒体解锁检测</span>
              </div>
              <Button
                size="sm"
                color="secondary"
                variant="flat"
                isLoading={streamingAllTesting}
                onPress={testAllStreaming}
                startContent={!streamingAllTesting && <IoRefresh />}
              >
                全部测试
              </Button>
            </div>
            
            <div className="grid grid-cols-6 gap-2">
              {streamingServices.map((service, index) => (
                <Card 
                  key={service.key}
                  isPressable
                  onPress={() => service.status !== 'testing' && testSingleStreaming(index)}
                  className={`${CARD_STYLES.GLASS_ITEM_CARD} ${service.status === 'testing' ? 'opacity-50 scale-95' : 'hover:scale-105'}`}
                >
                  <CardBody className="p-3 text-center">
                    <img 
                      src={service.icon} 
                      alt={service.name} 
                      className="w-6 h-6 mx-auto mb-1" 
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>'
                      }}
                    />
                    <div className="text-xs font-medium mb-2">{service.name}</div>
                    {service.status === 'testing' ? (
                      <div className="text-secondary text-xs animate-pulse">检测中...</div>
                    ) : service.status === 'unlocked' ? (
                      <div className="animate-in fade-in duration-200">
                        <div className="flex justify-center mb-1">
                          <IoCheckmarkCircle className="text-success text-xl animate-in zoom-in duration-200" />
                        </div>
                        <div className="text-success text-xs">{service.region || '已解锁'}</div>
                      </div>
                    ) : service.status === 'locked' ? (
                      <div className="animate-in fade-in duration-200">
                        <div className="flex justify-center mb-1">
                          <IoCloseCircle className="text-danger text-xl animate-in zoom-in duration-200" />
                        </div>
                        <div className="text-danger text-xs">未解锁</div>
                      </div>
                    ) : service.status === 'error' ? (
                      <div className="animate-in fade-in duration-200">
                        <div className="flex justify-center mb-1">
                          <IoCloseCircle className="text-warning text-xl animate-in zoom-in duration-200" />
                        </div>
                        <div className="text-warning text-xs" title={service.error}>检测失败</div>
                      </div>
                    ) : (
                      <div className="text-secondary text-xs">点击检测</div>
                    )}
                  </CardBody>
                </Card>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* IP 信息 */}
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/20">
                  <IoLocation className="text-primary text-lg" />
                </div>
                <span className="font-medium">IP 信息</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  isIconOnly
                  variant="light"
                  onPress={() => setShowIp(!showIp)}
                  title={showIp ? '隐藏 IP' : '显示 IP'}
                >
                  {showIp ? <IoEyeOff className="text-base" /> : <IoEye className="text-base" />}
                </Button>
                <Button
                  size="sm"
                  isIconOnly
                  variant="light"
                  onPress={copyIpInfo}
                  title="复制 IP 信息"
                  isDisabled={!ipInfo}
                >
                  <IoCopy className="text-base" />
                </Button>
                <Button
                  size="sm"
                  isIconOnly
                  variant="light"
                  isLoading={ipLoading}
                  onPress={fetchIpInfo}
                  title="刷新"
                >
                  <IoRefresh className="text-base" />
                </Button>
              </div>
            </div>
            
            {ipLoading && !ipInfo ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4 rounded" />
                <Skeleton className="h-4 w-1/2 rounded" />
                <Skeleton className="h-4 w-2/3 rounded" />
              </div>
            ) : ipError ? (
              <div className="text-danger text-sm">{ipError}</div>
            ) : ipInfo ? (
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div>
                  <span className="text-foreground-400 mr-2">IP</span>
                  <span className="font-mono">{showIp ? ipInfo.ip : '••••••••••'}</span>
                </div>
                <div>
                  <span className="text-foreground-400 mr-2">国家/地区</span>
                  <span>{ipInfo.country}</span>
                </div>
                <div>
                  <span className="text-foreground-400 mr-2">城市</span>
                  <span>{ipInfo.city}, {ipInfo.region}</span>
                </div>
                <div>
                  <span className="text-foreground-400 mr-2">时区</span>
                  <span>{ipInfo.timezone}</span>
                </div>
                <div>
                  <span className="text-foreground-400 mr-2">ISP</span>
                  <span title={ipInfo.isp}>{ipInfo.isp}</span>
                </div>
                <div>
                  <span className="text-foreground-400 mr-2">ASN</span>
                  <span title={ipInfo.as}>{ipInfo.as}</span>
                </div>
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </BasePage>
  )
}

export default Tools
