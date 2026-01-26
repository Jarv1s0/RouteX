import React, { useState, useCallback, useEffect } from 'react'
import BasePage from '@renderer/components/base/base-page'
import { Card, CardBody, Input, Button, Tabs, Tab, Chip, Skeleton } from '@heroui/react'
import { IoSearch, IoGlobe, IoShield, IoWifi, IoCheckmarkCircle, IoCloseCircle, IoRefresh, IoLocation, IoEye, IoEyeOff, IoCopy, IoPlay, IoBusiness, IoTime, IoServer, IoMap, IoFlag } from 'react-icons/io5'
import { mihomoDnsQuery, testRuleMatch, testConnectivity, fetchIpInfo as fetchIpInfoIpc, checkStreamingUnlock } from '@renderer/utils/ipc'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { IPCheckModal } from '@renderer/components/tools/ip-check-modal'

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
  { name: 'Twitter', url: 'https://twitter.com', icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Twitter.png' },
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

  // IP 纯净度检测
  const [showIpCheckModal, setShowIpCheckModal] = useState(false)

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
      <IPCheckModal isOpen={showIpCheckModal} onClose={() => setShowIpCheckModal(false)} />
      <div className="p-2 space-y-2">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">

        {/* IP 纯净度检测卡片 */}
        <Card isPressable onPress={() => setShowIpCheckModal(true)} className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
             <CardBody className="flex flex-row items-center gap-4 p-4">
                <div className="p-3 rounded-full bg-blue-500/20 text-blue-500">
                    <IoShield className="text-2xl" />
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-semibold">IP 纯净度检测</h3>
                    <p className="text-small text-foreground-500">
                        检测当前节点的 IP 风险值、欺诈分数及流媒体解锁情况 (ping0.cc)
                    </p>
                </div>
                <Button color="primary" variant="flat" onPress={() => setShowIpCheckModal(true)}>
                    开始检测
                </Button>
             </CardBody>
        </Card>

          {/* DNS 查询 */}
          <Card className="h-full">
            <CardBody className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-primary/20">
                  <IoGlobe className="text-primary text-lg" />
                </div>
                <span className="font-medium">DNS 查询</span>
                <span className="text-foreground-400 text-xs">（A: IPv4, AAAA: IPv6, CNAME: 别名）</span>
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
                  classNames={{
                    ...CARD_STYLES.GLASS_TABS,
                    tabList: CARD_STYLES.GLASS_TABS.tabList + " gap-1"
                  }}
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
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  {dnsResult.map((ip, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-xl bg-default-100/50 border border-default-200/50">
                      <Chip size="sm" variant="flat" color="primary" className="h-6">{dnsType}</Chip>
                      <span className="font-mono text-sm select-all">{ip}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* 规则测试 */}
          <Card className="h-full">
            <CardBody className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-warning/20">
                  <IoShield className="text-warning text-lg" />
                </div>
                <span className="font-medium">规则测试</span>
                <span className="text-foreground-400 text-xs">（发起请求测试实际匹配规则）</span>
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
                <div className="p-3 rounded-xl bg-content2/50 border border-default-200/50 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex flex-col gap-1">
                    <span className="text-foreground-400 text-xs">匹配规则</span>
                    <div className="font-mono text-sm bg-background/50 p-1.5 rounded-lg border border-default-100">
                      {ruleResult.rule}{ruleResult.rulePayload ? `,${ruleResult.rulePayload}` : ''}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-foreground-400 text-xs">出站代理</span>
                    <div><Chip size="sm" variant="flat" color="success" className="h-6">{ruleResult.proxy}</Chip></div>
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
            
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {connectivityResults.map((result, index) => (
                <Card 
                  key={result.name}
                  isPressable
                  onPress={() => !result.testing && testSingleConnectivity(index)}
                  className={`${CARD_STYLES.GLASS_ITEM_CARD} ${result.testing ? 'opacity-70 scale-[0.98]' : 'hover:scale-[1.05] hover:shadow-[0_8px_16px_rgba(0,0,0,0.1)] hover:border-success/30'} transition-all duration-300 border-transparent`}
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
            
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {streamingServices.map((service, index) => (
                <Card 
                  key={service.key}
                  isPressable
                  onPress={() => service.status !== 'testing' && testSingleStreaming(index)}
                  className={`${CARD_STYLES.GLASS_ITEM_CARD} ${service.status === 'testing' ? 'opacity-70 scale-[0.98]' : 'hover:scale-[1.05] hover:shadow-[0_8px_16px_rgba(0,0,0,0.1)] hover:border-secondary/30'} transition-all duration-300 border-transparent`}
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
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="col-span-2 lg:col-span-3 p-3 rounded-xl bg-default-100/50 border border-default-200/50 flex items-center justify-between group hover:bg-default-200/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <IoGlobe className="text-xl" />
                    </div>
                    <div>
                      <div className="text-xs text-foreground-400">公开 IP 地址</div>
                      <div className="font-mono text-lg font-bold tracking-wide">
                        {showIp ? ipInfo?.ip : '•••• •••• •••• ••••'}
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant="flat" color="primary" className="font-medium" onPress={copyIpInfo}>
                    复制
                  </Button>
                </div>

                <div className="p-3 rounded-xl bg-default-50/50 border border-default-200/30 flex items-center gap-3 hover:bg-default-100/50 transition-colors">
                  <div className="p-1.5 rounded-lg bg-success/10 text-success">
                    <IoFlag />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-foreground-400">国家/地区</div>
                    <div className="text-sm font-medium truncate" title={ipInfo?.country}>{ipInfo?.country}</div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-default-50/50 border border-default-200/30 flex items-center gap-3 hover:bg-default-100/50 transition-colors">
                  <div className="p-1.5 rounded-lg bg-warning/10 text-warning">
                    <IoMap />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-foreground-400">城市</div>
                    <div className="text-sm font-medium truncate" title={`${ipInfo?.city}, ${ipInfo?.region}`}>{ipInfo?.city}, {ipInfo?.region}</div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-default-50/50 border border-default-200/30 flex items-center gap-3 hover:bg-default-100/50 transition-colors">
                  <div className="p-1.5 rounded-lg bg-secondary/10 text-secondary">
                    <IoBusiness />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-foreground-400">ISP 运营商</div>
                    <div className="text-sm font-medium truncate" title={ipInfo?.isp}>{ipInfo?.isp}</div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-default-50/50 border border-default-200/30 flex items-center gap-3 hover:bg-default-100/50 transition-colors">
                  <div className="p-1.5 rounded-lg bg-danger/10 text-danger">
                    <IoServer />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-foreground-400">ASN 组织</div>
                    <div className="text-sm font-medium truncate" title={ipInfo?.as}>{ipInfo?.as}</div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-default-50/50 border border-default-200/30 flex items-center gap-3 hover:bg-default-100/50 transition-colors">
                  <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                    <IoTime />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-foreground-400">时区</div>
                    <div className="text-sm font-medium truncate">{ipInfo?.timezone}</div>
                  </div>
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
