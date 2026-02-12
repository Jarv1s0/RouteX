import React, { useMemo, useState } from 'react'
import { Card, CardBody, Tabs, Tab } from '@heroui/react'
import { calcTraffic } from '@renderer/utils/calc'
import { CARD_STYLES } from '@renderer/utils/card-styles'

interface RankingListProps {
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

const RankingList: React.FC<RankingListProps> = ({
  ruleStats,
  ruleHitDetails,
  onSelectRule
}) => {
  const [rankingTab, setRankingTab] = useState<'rule' | 'process' | 'host'>('rule')

  // 规则效率排行
  const ruleRanking = useMemo(() => {
    const entries = Array.from(ruleStats.entries())
    const totalHits = entries.reduce((sum, [, stat]) => sum + stat.hits, 0)
    const totalTraffic = entries.reduce((sum, [, stat]) => sum + stat.upload + stat.download, 0)
    
    return entries
      .map(([rule, stat]) => {
        const details = ruleHitDetails.get(rule) || []
        const lastProxy = details.length > 0 ? details[0].proxy : ''
        
        return {
          rule,
          hits: stat.hits,
          traffic: stat.upload + stat.download,
          hitPercent: totalHits > 0 ? Math.round((stat.hits / totalHits) * 100) : 0,
          trafficPercent: totalTraffic > 0 ? Math.round(((stat.upload + stat.download) / totalTraffic) * 100) : 0,
          proxy: lastProxy
        }
      })
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10)
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
      .slice(0, 10)
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
      .slice(0, 10)
  }, [ruleHitDetails])

  const currentRanking = useMemo(() => {
    switch (rankingTab) {
      case 'process':
        return processRanking
      case 'host':
        return hostRanking
      case 'rule':
      default:
        return ruleRanking.map(r => ({ name: r.rule, traffic: r.traffic, hits: r.hits }))
    }
  }, [rankingTab, ruleRanking, processRanking, hostRanking])

  return (
    <Card className={`${CARD_STYLES.GLASS_CARD} h-full`}>
      <CardBody className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-primary/80" />
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
        <div className="space-y-3">
          {currentRanking.length === 0 ? (
            <div className="h-[200px] flex flex-col items-center justify-center text-foreground-400 gap-2">
              <div className="text-4xl opacity-30">📋</div>
              <div className="text-sm">暂无数据</div>
              <div className="text-xs text-foreground-500">连接产生后将自动统计</div>
            </div>
          ) : (
            currentRanking.map((item, index) => {
              const barColors = [
                '#006FEE', '#17C964', '#F5A524', '#F31260', '#7828C8', 
                '#06B6D4', '#EC4899', '#8B5CF6', '#F97316', '#14B8A6',
              ]
              const barColor = barColors[index % barColors.length]
              
              const isRuleRanking = rankingTab === 'rule'
              
              const getMaxMetric = () => {
               if (isRuleRanking && currentRanking.length > 0 && 'hits' in currentRanking[0]) {
                 return (currentRanking[0] as { hits: number }).hits || 1
               }
               return currentRanking[0]?.traffic || 1
              }
              
              const getMetric = (itm: typeof item) => {
                if (isRuleRanking && 'hits' in itm) {
                  return (itm as { hits: number }).hits
                }
                return itm.traffic
              }

              const maxMetric = getMaxMetric()
              const metric = getMetric(item)
              
              const percentage = Math.max((metric / maxMetric) * 100, 3)
              
              return (
                <div 
                  key={item.name}
                  className="flex items-center gap-2 group cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => rankingTab === 'rule' && onSelectRule(item.name)}
                >
                  <div className="w-[120px] text-sm text-left truncate" title={item.name}>
                    {item.name}
                  </div>
                  <span 
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white"
                    style={{ backgroundColor: barColor }}
                  >
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-[100px] h-4 bg-default-100/50 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-300"
                      style={{ 
                        width: `${percentage}%`,
                        backgroundColor: `${barColor}66`
                      }}
                    />
                  </div>
                  <div className="text-sm font-medium tabular-nums whitespace-nowrap shrink-0 flex items-center gap-2 justify-end min-w-[80px]">
                    {isRuleRanking && 'hits' in item && (
                      <span className="text-foreground-500 text-xs mr-1">
                        {(item as { hits: number }).hits} 次
                      </span>
                    )}
                    <span>{calcTraffic(item.traffic)}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </CardBody>
    </Card>
  )
}

export default RankingList
