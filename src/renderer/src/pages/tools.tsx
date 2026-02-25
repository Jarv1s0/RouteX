import React, { useState, useCallback, useEffect, useRef } from 'react'
import BasePage from '@renderer/components/base/base-page'
import { Card, CardBody, Input, Button, Tabs, Tab, Chip, Skeleton } from '@heroui/react'
import { IoSearch, IoGlobe, IoShield, IoWifi, IoCheckmarkCircle, IoCloseCircle, IoRefresh, IoLocation, IoMap, IoTime, IoBusiness, IoServer, IoCopy, IoEye, IoEyeOff } from 'react-icons/io5'
import { mihomoDnsQuery, testRuleMatch, testConnectivity, fetchIpInfo as fetchIpInfoIpc, checkStreamingUnlock, fetchBatchIpInfo } from '@renderer/utils/ipc'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { IPCheckModal } from '@renderer/components/tools/ip-check-modal'
import { IpCheckerPanel } from '@renderer/components/tools/ip-checker-panel'

interface CombinedTestTarget {
  id: string
  name: string
  url?: string
  icon: string
  type: 'connectivity' | 'streaming'
  status: 'idle' | 'testing' | 'success' | 'locked' | 'unlocked' | 'error'
  latency: number
  region?: string
  error?: string
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

const defaultStreamingServices = [
  { key: 'chatgpt', name: 'ChatGPT', icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/ChatGPT.png' },
  { key: 'gemini', name: 'Gemini', icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Google.png' },
  { key: 'netflix', name: 'Netflix', icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Netflix.png' },
  { key: 'youtube', name: 'YouTube', icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/YouTube.png' },
  { key: 'spotify', name: 'Spotify', icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Spotify.png' },
  { key: 'tiktok', name: 'TikTok', icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/TikTok.png' }
]

const defaultTestTargets: CombinedTestTarget[] = [
  ...defaultTargets.map(t => ({ 
    id: t.name, 
    ...t, 
    type: 'connectivity' as const, 
    status: 'idle' as const, 
    latency: -1 
  })),
  ...defaultStreamingServices.map(s => ({ 
    id: s.key, 
    name: s.name, 
    icon: s.icon, 
    type: 'streaming' as const, 
    status: 'idle' as const, 
    latency: -1 
  }))
]

const Tools: React.FC = () => {
  // DNS 查询
  const [dnsQuery, setDnsQuery] = useState('')
  const [dnsType, setDnsType] = useState<'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT'>('A')
  const [dnsResult, setDnsResult] = useState<{ ip: string; country?: string; region?: string }[]>([])
  const [dnsLoading, setDnsLoading] = useState(false)
  const [dnsError, setDnsError] = useState<string | null>(null)

  // IP 纯净度检测
  const [showIpCheckModal, setShowIpCheckModal] = useState(false)

  // 规则测试
  const [ruleQuery, setRuleQuery] = useState('')
  const [ruleResult, setRuleResult] = useState<{ rule: string; rulePayload: string; proxy: string } | null>(null)
  const [ruleLoading, setRuleLoading] = useState(false)
  const [ruleError, setRuleError] = useState<string | null>(null)

  // 合并测试状态
  const [testTargets, setTestTargets] = useState<CombinedTestTarget[]>(defaultTestTargets)
  const testTargetsRef = useRef(testTargets)
  testTargetsRef.current = testTargets  // 始终保持最新引用
  const [allTesting, setAllTesting] = useState(false)

  // IP 信息
  const [ipInfo, setIpInfo] = useState<IpInfo | null>(null)
  const [ipLoading, setIpLoading] = useState(false)
  const [showIp, setShowIp] = useState(false)
  const [ipError, setIpError] = useState<string | null>(null)

  const handleDnsQuery = async (): Promise<void> => {
    if (!dnsQuery.trim()) return
    setDnsLoading(true)
    setDnsError(null)
    setDnsResult([])
    try {
      const result = await mihomoDnsQuery(dnsQuery.trim(), dnsType)
      if (result.Answer && result.Answer.length > 0) {
        const ips = result.Answer.map(a => a.data)
        // 自动查询归属地
        try {
          const geoInfos = await fetchBatchIpInfo(ips.map(ip => ({ query: ip, lang: 'zh-CN' })))
          const resultsWithGeo = ips.map((ip, index) => {
            const geo = geoInfos[index]
            return {
              ip,
              country: geo?.status === 'success' ? geo.country : undefined,
              region: geo?.status === 'success' ? geo.regionName : undefined
            }
          })
          setDnsResult(resultsWithGeo)
        } catch {
          // 如果归属地查询失败，只显示 IP
          setDnsResult(ips.map(ip => ({ ip })))
        }
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

  const testSingle = async (index: number): Promise<void> => {
    setTestTargets(prev => {
      const next = [...prev]
      next[index] = { ...next[index], status: 'testing', region: undefined, error: undefined }
      return next
    })
    
    // 从 ref 读取最新状态，避免并发调用时闭包捕获过期值
    const target = testTargetsRef.current[index]
    if (!target) return
    try {
      if (target.type === 'connectivity') {
        const result = await testConnectivity(target.url!, 5000)
        setTestTargets(prev => {
          const next = [...prev]
          next[index] = { 
            ...next[index], 
            status: result.success ? 'success' : 'error', 
            latency: result.latency,
            error: result.error,
          }
          return next
        })
      } else {
        const result = await checkStreamingUnlock(target.id)
        setTestTargets(prev => {
          const next = [...prev]
          next[index] = { 
            ...next[index], 
            status: result.status,
            region: result.region,
            error: result.error
          }
          return next
        })
      }
    } catch (e) {
      setTestTargets(prev => {
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

  const testAll = async (): Promise<void> => {
    setAllTesting(true)
    setTestTargets(prev => prev.map(t => ({ ...t, status: 'testing', region: undefined, error: undefined })))
    
    await Promise.allSettled(
      testTargetsRef.current.map((_, index) => testSingle(index))
    )
    
    setAllTesting(false)
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

  const [probeResults, setProbeResults] = useState<Record<string, { ip: string, location: string, isp: string }>>({})

  // 复制 IP 信息
  const copyIpInfo = useCallback(async () => {
    if (!ipInfo) return
    let info = `原生本机 IP: ${ipInfo.ip}
地理位置: ${ipInfo.country} ${ipInfo.city}, ${ipInfo.region}
时区: ${ipInfo.timezone}
ISP: ${ipInfo.isp}
ASN: ${ipInfo.as}`

    if (Object.keys(probeResults).length > 0) {
      info += '\n\n--- 探针检测结果 ---\n'
      Object.entries(probeResults).forEach(([id, res]) => {
        const nameMap: Record<string, string> = { ipip: 'IPIP.net', cloudflare: 'Cloudflare', ipinfo: 'IPinfo.io' }
        info += `[${nameMap[id] || id}] IP: ${res.ip} | 归属: ${res.location} ${res.isp}\n`
      })
    }

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
  }, [ipInfo, probeResults])

  // 初始加载 IP 信息
  useEffect(() => {
    fetchIpInfo()
  }, [fetchIpInfo])

  return (
    <BasePage title="工具">
      <IPCheckModal isOpen={showIpCheckModal} onClose={() => setShowIpCheckModal(false)} />
      <div className="p-2 space-y-2">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">



          {/* DNS 查询 */}
          <Card className={`${CARD_STYLES.BASE} ${CARD_STYLES.INACTIVE} h-full hover:!scale-100 !cursor-default`}>
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
                  {dnsResult.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-xl bg-default-100/50 border border-default-200/50">
                      <Chip size="sm" variant="flat" color="primary" className="h-6 shrink-0">{dnsType}</Chip>
                      <span className="font-mono text-sm select-all">{item.ip}</span>
                      {(item.country || item.region) && (
                        <div className="flex items-center gap-1 ml-2">
                          <IoLocation className="text-primary-500 text-sm" />
                          <span className="text-sm text-primary-600 dark:text-primary-400 font-bold">
                            {item.country} {item.region}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* 规则测试 */}
          <Card className={`${CARD_STYLES.BASE} ${CARD_STYLES.INACTIVE} h-full hover:!scale-100 !cursor-default`}>
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

        {/* 网络与服务检测 */}
        <Card className={`${CARD_STYLES.BASE} ${CARD_STYLES.INACTIVE} hover:!scale-100 !cursor-default`}>
          <CardBody className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-success/20">
                  <IoWifi className="text-success text-lg" />
                </div>
                <span className="font-medium">网络与服务检测</span>
              </div>
              <Button
                size="sm"
                color="success"
                variant="flat"
                isLoading={allTesting}
                onPress={testAll}
                startContent={!allTesting && <IoRefresh />}
              >
                全部测试
              </Button>
            </div>
            
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {testTargets.map((target, index) => (
                <Card 
                  key={target.id}
                  isPressable
                  onPress={() => target.status !== 'testing' && testSingle(index)}
                  className={`${CARD_STYLES.GLASS_ITEM_CARD} ${target.status === 'testing' ? 'opacity-70 scale-[0.98]' : 'hover:scale-[1.05] hover:shadow-[0_8px_16px_rgba(0,0,0,0.1)] hover:border-success/30'} transition-all duration-300 border-transparent`}
                >
                  <CardBody className="p-3 text-center">
                    <img 
                      src={target.icon} 
                      alt={target.name} 
                      className="w-6 h-6 mx-auto mb-1" 
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>'
                      }}
                    />
                    <div className="text-xs font-medium mb-2">{target.name}</div>
                    {target.status === 'testing' ? (
                      <div className="text-primary text-xs animate-pulse">检测中...</div>
                    ) : target.status === 'success' || target.status === 'unlocked' ? (
                      <div className="animate-in fade-in duration-200">
                        <div className="flex justify-center mb-1">
                          <IoCheckmarkCircle className="text-success text-xl animate-in zoom-in duration-200" />
                        </div>
                        <div className="text-success text-xs">
                          {target.type === 'connectivity' ? `${target.latency}ms` : (target.region || '已解锁')}
                        </div>
                      </div>
                    ) : target.status === 'locked' ? (
                      <div className="animate-in fade-in duration-200">
                        <div className="flex justify-center mb-1">
                          <IoCloseCircle className="text-danger text-xl animate-in zoom-in duration-200" />
                        </div>
                        <div className="text-danger text-xs">未解锁</div>
                      </div>
                    ) : target.status === 'error' ? (
                      <div className="animate-in fade-in duration-200">
                        <div className="flex justify-center mb-1">
                          <IoCloseCircle className="text-warning text-xl animate-in zoom-in duration-200" />
                        </div>
                        <div className="text-warning text-xs" title={target.error}>检测失败</div>
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

        {/* IP 信息 */}
        <Card className={`${CARD_STYLES.BASE} ${CARD_STYLES.INACTIVE} hover:!scale-100 !cursor-default`}>
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 原始 IP 信息 (左列) */}
                <div className="grid grid-cols-1 gap-3 h-fit">
                  {/* 第 1 行：公开 IP 地址 */}
                  <div className="p-4 rounded-xl bg-default-100/50 border border-default-200/50 flex items-center justify-between group hover:bg-default-200/50 transition-colors h-[72px]">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                        <IoGlobe className="text-xl" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs text-foreground-400">公开 IP 地址</div>
                        <div className="flex items-center gap-2">
                          <div className="font-mono text-lg font-bold tracking-wide truncate">
                            {showIp ? ipInfo?.ip : '•••.•••.•••.•••'}
                          </div>
                          {showIp && (
                            <IoCopy 
                              className="text-foreground-400 hover:text-primary cursor-pointer transition-colors text-base shrink-0" 
                              onClick={copyIpInfo}
                              title="全部复制"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 第 2 行：国家/地区、城市、时区 */}
                  <div className="p-4 rounded-xl bg-default-50/50 border border-default-200/30 flex items-center gap-4 hover:bg-default-100/50 transition-colors h-[72px]">
                    <div className="flex items-center gap-3 min-w-0 flex-1 border-r border-default-200/50 pr-2">
                      <div className="p-2 rounded-lg bg-success/10 text-success shrink-0">
                        <IoMap className="text-lg" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-foreground-400">国家与城市</div>
                        <div className="text-sm font-medium truncate" title={`${ipInfo?.country} ${ipInfo?.city}`}>
                          {ipInfo?.country} {ipInfo?.city}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="p-2 rounded-lg bg-warning/10 text-warning shrink-0">
                        <IoTime className="text-lg" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-foreground-400">时区</div>
                        <div className="text-sm font-medium truncate" title={ipInfo?.timezone}>{ipInfo?.timezone}</div>
                      </div>
                    </div>
                  </div>

                  {/* 第 3 行：ISP 运营商与 ASN */}
                  <div className="p-4 rounded-xl bg-default-50/50 border border-default-200/30 flex items-center gap-4 hover:bg-default-100/50 transition-colors h-[72px]">
                    <div className="flex items-center gap-3 min-w-0 flex-1 border-r border-default-200/50 pr-2">
                      <div className="p-2 rounded-lg bg-secondary/10 text-secondary shrink-0">
                        <IoBusiness className="text-lg" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-foreground-400">ISP 运营商</div>
                        <div className="text-sm font-medium truncate" title={ipInfo?.isp}>{ipInfo?.isp}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="p-2 rounded-lg bg-danger/10 text-danger shrink-0">
                        <IoServer className="text-lg" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-foreground-400">ASN 组织</div>
                        <div className="text-sm font-medium truncate" title={ipInfo?.as}>{ipInfo?.as}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 第三方 IP 测试探针 (右列) */}
                <div className="grid grid-cols-1 gap-3 h-fit">
                  <IpCheckerPanel showIp={showIp} onResultsChange={setProbeResults} />
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
