import React, { useMemo, useState } from 'react'
import { Card, CardBody, Tabs, Tab } from '@heroui/react'
import { calcTraffic } from '@renderer/utils/calc'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import TrafficOverview from './traffic-overview'

interface TrafficRankingProps {
  session: { upload: number; download: number }
  today: { upload: number; download: number }
  ruleStats: Map<string, { hits: number; upload: number; download: number }>
  ruleHitDetails: Map<string, Array<{
    id: string
    time: string
    host: string
    process: string
    proxy: string
    upload: number
    download: number
  }>>
  onSelectRule: (rule: string) => void
}

const RANKING_PALETTE = [
  {
    badge: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
    bar: 'linear-gradient(90deg, #0f766e 0%, #22d3ee 100%)',
    glow: 'rgba(34, 211, 238, 0.22)',
    track: 'rgba(15, 118, 110, 0.08)'
  },
  {
    badge: 'linear-gradient(135deg, #1d4ed8 0%, #60a5fa 100%)',
    bar: 'linear-gradient(90deg, #2563eb 0%, #7dd3fc 100%)',
    glow: 'rgba(96, 165, 250, 0.2)',
    track: 'rgba(37, 99, 235, 0.08)'
  },
  {
    badge: 'linear-gradient(135deg, #6d28d9 0%, #a78bfa 100%)',
    bar: 'linear-gradient(90deg, #7c3aed 0%, #c4b5fd 100%)',
    glow: 'rgba(167, 139, 250, 0.2)',
    track: 'rgba(124, 58, 237, 0.08)'
  },
  {
    badge: 'linear-gradient(135deg, #be123c 0%, #fb7185 100%)',
    bar: 'linear-gradient(90deg, #e11d48 0%, #fda4af 100%)',
    glow: 'rgba(251, 113, 133, 0.18)',
    track: 'rgba(225, 29, 72, 0.08)'
  },
  {
    badge: 'linear-gradient(135deg, #c2410c 0%, #fb923c 100%)',
    bar: 'linear-gradient(90deg, #ea580c 0%, #fdba74 100%)',
    glow: 'rgba(251, 146, 60, 0.18)',
    track: 'rgba(234, 88, 12, 0.08)'
  },
  {
    badge: 'linear-gradient(135deg, #a16207 0%, #facc15 100%)',
    bar: 'linear-gradient(90deg, #ca8a04 0%, #fde047 100%)',
    glow: 'rgba(250, 204, 21, 0.18)',
    track: 'rgba(202, 138, 4, 0.08)'
  },
  {
    badge: 'linear-gradient(135deg, #166534 0%, #4ade80 100%)',
    bar: 'linear-gradient(90deg, #16a34a 0%, #86efac 100%)',
    glow: 'rgba(74, 222, 128, 0.18)',
    track: 'rgba(22, 163, 74, 0.08)'
  },
  {
    badge: 'linear-gradient(135deg, #0f766e 0%, #67e8f9 100%)',
    bar: 'linear-gradient(90deg, #0891b2 0%, #a5f3fc 100%)',
    glow: 'rgba(103, 232, 249, 0.18)',
    track: 'rgba(8, 145, 178, 0.08)'
  }
] as const

const TrafficRanking: React.FC<TrafficRankingProps> = ({
  session,
  today,
  ruleStats,
  ruleHitDetails,
  onSelectRule
}) => {
  const [rankingTab, setRankingTab] = useState<'rule' | 'process' | 'host'>('rule')

  // Ranking Logic
  // 规则效率排行
  const ruleRanking = useMemo(() => {
    const entries = Array.from(ruleStats.entries())
    const totalHits = entries.reduce((sum, [, stat]) => sum + stat.hits, 0)
    const totalTrafficVal = entries.reduce((sum, [, stat]) => sum + stat.upload + stat.download, 0)
    
    return entries
      .map(([rule, stat]) => {
        const details = ruleHitDetails.get(rule) || []
        const lastProxy = details.length > 0 ? details[0].proxy : ''
        
        return {
          name: rule,
          hits: stat.hits,
          traffic: stat.upload + stat.download,
          hitPercent: totalHits > 0 ? Math.round((stat.hits / totalHits) * 100) : 0,
          trafficPercent: totalTrafficVal > 0 ? Math.round(((stat.upload + stat.download) / totalTrafficVal) * 100) : 0,
          proxy: lastProxy
        }
      })
      .sort((a, b) => b.hits - a.hits) // Default sort by hits for rules? Or traffic? Let's use traffic for consistency with screenshot visual
      .slice(0, 8)
  }, [ruleStats, ruleHitDetails])

  // 进程排行
  const processRanking = useMemo(() => {
    const processMap = new Map<string, { upload: number; download: number }>()
    
    ruleHitDetails.forEach((details) => {
      details.forEach((detail) => {
        const processName = detail.process || '-'
        const existing = processMap.get(processName) || { upload: 0, download: 0 }
        existing.upload += detail.upload
        existing.download += detail.download
        processMap.set(processName, existing)
      })
    })
    
    return Array.from(processMap.entries())
      .map(([name, stat]) => ({
        name,
        traffic: stat.upload + stat.download
      }))
      .sort((a, b) => b.traffic - a.traffic)
      .slice(0, 8)
  }, [ruleHitDetails])

  // 主机排行
  const hostRanking = useMemo(() => {
    const hostMap = new Map<string, { upload: number; download: number }>()
    
    ruleHitDetails.forEach((details) => {
      details.forEach((detail) => {
        const host = detail.host || '-'
        const shortHost = host.length > 20 ? host.split('.').slice(-2).join('.') : host
        const existing = hostMap.get(shortHost) || { upload: 0, download: 0 }
        existing.upload += detail.upload
        existing.download += detail.download
        hostMap.set(shortHost, existing)
      })
    })
    
    return Array.from(hostMap.entries())
      .map(([name, stat]) => ({
        name,
        traffic: stat.upload + stat.download
      }))
      .sort((a, b) => b.traffic - a.traffic)
      .slice(0, 8)
  }, [ruleHitDetails])

  const currentRanking = useMemo(() => {
    switch (rankingTab) {
      case 'process':
        return processRanking
      case 'host':
        return hostRanking
      case 'rule':
      default:
        // 按命中次数排序
        return ruleRanking.sort((a,b) => b.hits - a.hits).slice(0, 8)
    }
  }, [rankingTab, ruleRanking, processRanking, hostRanking])



  return (
    <Card className={`${CARD_STYLES.BASE} ${CARD_STYLES.INACTIVE} hover:!scale-100 !cursor-default h-full`}>
      <CardBody className="p-4">
        <div className="flex flex-col md:flex-row gap-6 h-full">
            {/* Left: Traffic Summary */}
            <div className="flex-1 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                          <div className="w-1.5 h-3.5 bg-primary/80 rounded-full" />
                        </div>
                        <span className="text-base font-bold text-foreground">流量汇总</span>
                    </div>
                </div>

                
                {/* Traffic Overview Component */}
                <div className="flex-1 flex flex-col items-center justify-center">
                    <TrafficOverview 
                        sessionUpload={session.upload}
                        sessionDownload={session.download}
                        todayUpload={today.upload}
                        todayDownload={today.download}
                    />
                </div>

            </div>

            {/* Divider */}
            <div className="hidden md:block w-px bg-default-100 mx-2 self-stretch" />

            {/* Right: Ranking List */}
            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                 <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-secondary/10 text-secondary">
                          <div className="w-1.5 h-3.5 bg-secondary/80 rounded-full" />
                        </div>
                       <span className="text-base font-bold text-foreground">排行榜</span>
                    </div>
                    <Tabs
                        size="sm"
                        classNames={CARD_STYLES.GLASS_TABS}
                        selectedKey={rankingTab}
                        onSelectionChange={(key) => setRankingTab(key as 'rule' | 'process' | 'host')}
                    >
                        <Tab key="rule" title="策略" />
                        <Tab key="process" title="进程" />
                        <Tab key="host" title="主机" />
                    </Tabs>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-2 space-y-3 min-h-[180px] max-h-[300px]">
                    {currentRanking.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-foreground-400 gap-2">
                            <div className="text-4xl opacity-30">📋</div>
                            <div className="text-sm">暂无数据</div>
                        </div>
                    ) : (
                        currentRanking.map((item, index) => {
                              const palette = RANKING_PALETTE[index % RANKING_PALETTE.length]
                              // Rule tab: max is max hits, others: max traffic
                              const maxMetric = rankingTab === 'rule' 
                                ? (currentRanking[0] as { hits?: number }).hits || 1
                                : currentRanking[0]?.traffic || 1
                              const currentMetric = rankingTab === 'rule' 
                                ? (item as { hits?: number }).hits || 0
                                : item.traffic
                              const percentage = Math.max((currentMetric / maxMetric) * 100, 2)

                              return (
                                <div 
                                  key={item.name}
                                  className="flex items-center gap-3 group cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => rankingTab === 'rule' && onSelectRule(item.name)}
                                >
                                  <div className="w-[120px] text-sm text-left truncate flex-shrink-0" title={item.name}>
                                    {item.name}
                                  </div>
                                  <span 
                                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                    style={{
                                      background: palette.badge,
                                      boxShadow: `0 6px 18px ${palette.glow}`
                                    }}
                                  >
                                    {index + 1}
                                  </span>
                                  <div className="flex-1 h-2.5 rounded-full overflow-visible">
                                     <div 
                                        className="h-full rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
                                        style={{
                                          width: `${percentage}%`,
                                          background: palette.bar,
                                          boxShadow: `0 8px 18px ${palette.glow}`
                                        }}
                                     />
                                  </div>
                                  <div className="text-sm font-medium tabular-nums whitespace-nowrap flex-shrink-0 w-[90px] text-right">
                                    {rankingTab === 'rule' && (
                                         <span className="text-xs text-foreground-400 tabular-nums mr-1">
                                            {(item as { hits?: number }).hits}次
                                         </span>
                                      )}
                                    {calcTraffic(item.traffic)}
                                  </div>
                                </div>
                              )
                        })
                    )}
                </div>
            </div>
        </div>
      </CardBody>
    </Card>
  )
}

export default TrafficRanking
