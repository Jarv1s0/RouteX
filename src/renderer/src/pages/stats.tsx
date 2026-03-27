import React, { useState, useCallback } from 'react'
import BasePage from '@renderer/components/base/base-page'
import { Button, Modal, ModalContent, ModalHeader, ModalBody } from '@heroui/react'
import { clearTrafficStats, clearProviderStats } from '@renderer/utils/stats-ipc'
import { IoClose } from 'react-icons/io5'
import { CgTrash } from 'react-icons/cg'
import ConfirmModal from '@renderer/components/base/base-confirm'


import StatusGrid from '@renderer/components/stats/status-grid'
import TrafficChart from '@renderer/components/stats/traffic-chart'
import ProviderUsage from '@renderer/components/stats/provider-usage'
import TrafficRanking from '@renderer/components/stats/traffic-ranking'
import RuleDetailList from '@renderer/components/stats/rule-detail-list'
import { useTrafficStore } from '@renderer/store/use-traffic-store'
import { notifyError } from '@renderer/utils/notify'

interface RuleHitDetail {
  id: string
  time: string
  host: string
  process: string
  proxy: string
  upload: number
  download: number
}

const EMPTY_RULE_HIT_DETAILS: RuleHitDetail[] = []

const TrafficChartSection = React.memo(function TrafficChartSection() {
  const trafficHistory = useTrafficStore((state) => state.trafficHistory)
  const hourlyData = useTrafficStore((state) => state.hourlyData)
  const dailyData = useTrafficStore((state) => state.dailyData)

  return (
    <TrafficChart
      trafficHistory={trafficHistory}
      hourlyData={hourlyData}
      dailyData={dailyData}
    />
  )
})

const TrafficRankingSection = React.memo(function TrafficRankingSection({
  onSelectRule
}: {
  onSelectRule: (rule: string) => void
}) {
  const sessionStats = useTrafficStore((state) => state.sessionStats)
  const dailyData = useTrafficStore((state) => state.dailyData)
  const ruleStats = useTrafficStore((state) => state.ruleStats)
  const ruleHitDetails = useTrafficStore((state) => state.ruleHitDetails)

  const todayStats = React.useMemo(() => {
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    return dailyData.find((item) => item.date === today) || { upload: 0, download: 0 }
  }, [dailyData])

  return (
    <TrafficRanking
      session={sessionStats}
      today={todayStats}
      ruleStats={ruleStats}
      ruleHitDetails={ruleHitDetails}
      onSelectRule={onSelectRule}
    />
  )
})

const ProviderUsageSection = React.memo(function ProviderUsageSection() {
  const providerData = useTrafficStore((state) => state.providerData)
  const currentProviders = useTrafficStore((state) => state.currentProviders)

  return <ProviderUsage providerData={providerData} currentProviders={currentProviders} />
})

const RuleDetailsModalSection = React.memo(
  function RuleDetailsModalSection({
    selectedRule,
    onClose
  }: {
    selectedRule: string | null
    onClose: () => void
  }) {
    const details = useTrafficStore((state) =>
      selectedRule ? (state.ruleHitDetails.get(selectedRule) ?? EMPTY_RULE_HIT_DETAILS) : EMPTY_RULE_HIT_DETAILS
    ) as RuleHitDetail[]

    return (
      <Modal
        isOpen={!!selectedRule}
        onClose={onClose}
        size="2xl"
        backdrop="blur"
        hideCloseButton
        classNames={{
          base: 'bg-background/95 dark:bg-default-50/95 backdrop-blur-2xl border border-default-200/50 shadow-2xl',
          header: 'border-b border-default-200/80 dark:border-default-100/30',
          body: 'pt-1.5 pb-4 px-3',
          backdrop: 'bg-black/50 backdrop-blur-sm'
        }}
      >
        <ModalContent>
          {(closeModal) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-2 pr-8">
                  <span>规则详情: {selectedRule}</span>
                  <span className="text-[10px] font-normal text-foreground-400 bg-default-100 px-1.5 py-0.5 rounded">Top 50 · 时间倒序</span>
                </div>
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={closeModal}
                  className="absolute right-4 top-4"
                >
                  <IoClose size={20} />
                </Button>
              </ModalHeader>
              <ModalBody>
                <RuleDetailList details={details.slice(0, 50)} />
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    )
  }
)

const Stats: React.FC = () => {
  const clearStats = useTrafficStore((state) => state.clearStats)
  
  // 清除统计数据状态
  const [clearingStats, setClearingStats] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [selectedRule, setSelectedRule] = useState<string | null>(null)

  // 清除统计数据
  const handleClearStats = useCallback(async () => {
    setClearingStats(true)
    try {
      await clearTrafficStats()
      await clearProviderStats()
      clearStats() // Clear local store
    } catch (e) {
      notifyError(`清除失败: ${e}`, { title: '清除统计失败' })
    } finally {
      setClearingStats(false)
      setShowClearConfirm(false)
    }
  }, [clearStats])

  return (
    <BasePage 
      title="统计"
      header={
        <Button
          size="sm"
          variant="light"
          color="danger"
          isIconOnly
          title="清除统计数据"
          isLoading={clearingStats}
          onPress={() => setShowClearConfirm(true)}
          className="app-nodrag"
        >
          <CgTrash className="text-lg" />
        </Button>
      }
    >
      {showClearConfirm && (
        <ConfirmModal
          onChange={setShowClearConfirm}
          title="确认清除统计数据？"
          description="此操作将清除所有流量统计数据，此操作不可恢复。"
          confirmText="确认清除"
          cancelText="取消"
          onConfirm={handleClearStats}
        />
      )}
      <div className="p-2 space-y-2">
        {/* Row 1: Status Grid */}
        <StatusGrid />

        {/* Row 2: Charts & Stats using CSS Grid */}
        {/* Stack: Traffic Chart -> Traffic Ranking -> Provider Usage */}
        <div className="flex flex-col gap-2">
          {/* Traffic Chart */}
          <TrafficChartSection />
          
          {/* Traffic Ranking (Merged) */}
          <TrafficRankingSection onSelectRule={setSelectedRule} />

          {/* Provider Usage */}
          <ProviderUsageSection />
        </div>

        {/* 规则命中详情弹窗 */}
        <RuleDetailsModalSection selectedRule={selectedRule} onClose={() => setSelectedRule(null)} />
      </div>
    </BasePage>
  )
}

export default Stats
