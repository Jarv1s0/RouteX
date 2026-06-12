import React, { useState, useCallback } from 'react'
import BasePage from '@renderer/components/base/base-page'
import { Button, Modal, ModalContent, ModalHeader, ModalBody } from '@heroui/react'
import { clearTrafficStats } from '@renderer/utils/stats-ipc'
import { IoClose } from 'react-icons/io5'
import { MdOutlineCleaningServices } from 'react-icons/md'
import ConfirmModal from '@renderer/components/base/base-confirm'
import { useMainPaneModalContentStyle } from '@renderer/hooks/use-main-pane-modal-style'

import StatusGrid from '@renderer/components/stats/status-grid'
import TrafficChart from '@renderer/components/stats/traffic-chart'
import TrafficRanking from '@renderer/components/stats/traffic-ranking'
import RuleDetailList from '@renderer/components/stats/rule-detail-list'
import RealtimeMetricsPanel from '@renderer/components/stats/realtime-metrics-panel'
import { useTrafficStore } from '@renderer/store/use-traffic-store'
import { notifyError } from '@renderer/utils/notify'
import { useI18n } from '@renderer/i18n'

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



const TrafficRankingSection = React.memo(function TrafficRankingSection({
  onSelectRule
}: {
  onSelectRule: (rule: string) => void
}) {
  const sessionStats = useTrafficStore((state) => state.sessionStats)
  const routeStats = useTrafficStore((state) => state.routeStats)
  const dailyData = useTrafficStore((state) => state.dailyData)
  const ruleStats = useTrafficStore((state) => state.ruleStats)
  const ruleHitDetails = useTrafficStore((state) => state.ruleHitDetails)

  const todayStats = React.useMemo(() => {
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    return dailyData.find((item) => item.date === today) || { upload: 0, download: 0 }
  }, [dailyData])

  const { weekStats, monthStats } = React.useMemo(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()
    const weekStart = new Date(currentYear, currentMonth, now.getDate())
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))

    return dailyData.reduce(
      (acc, item) => {
        const [year, month, day] = item.date.split('-').map(Number)
        if (!year || !month || !day) {
          return acc
        }

        const itemDate = new Date(year, month - 1, day)
        if (itemDate >= weekStart && itemDate <= now) {
          acc.weekStats.upload += item.upload
          acc.weekStats.download += item.download
        }
        if (itemDate.getFullYear() === currentYear && itemDate.getMonth() === currentMonth) {
          acc.monthStats.upload += item.upload
          acc.monthStats.download += item.download
        }

        return acc
      },
      {
        weekStats: { upload: 0, download: 0 },
        monthStats: { upload: 0, download: 0 }
      }
    )
  }, [dailyData])

  return (
    <TrafficRanking
      session={sessionStats}
      today={todayStats}
      week={weekStats}
      month={monthStats}
      route={routeStats}
      ruleStats={ruleStats}
      ruleHitDetails={ruleHitDetails}
      onSelectRule={onSelectRule}
    />
  )
})

const RuleDetailsModalSection = React.memo(function RuleDetailsModalSection({
  selectedRule,
  onClose
}: {
  selectedRule: string | null
  onClose: () => void
}) {
  const details = useTrafficStore((state) =>
    selectedRule
      ? (state.ruleHitDetails.get(selectedRule) ?? EMPTY_RULE_HIT_DETAILS)
      : EMPTY_RULE_HIT_DETAILS
  ) as RuleHitDetail[]
  const modalContentStyle = useMainPaneModalContentStyle(900)
  const { t } = useI18n()

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
      <ModalContent
        style={modalContentStyle}
      >
        {(closeModal) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <div className="flex items-center gap-2 pr-8">
                <span>{t('stats.ruleDetail', { rule: selectedRule || '' })}</span>
                <span className="text-[10px] font-normal text-foreground-400 bg-default-100 px-1.5 py-0.5 rounded">
                  {t('stats.top50ByTime')}
                </span>
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
})

const Stats: React.FC = () => {
  const { t } = useI18n()
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
      clearStats() // Clear local store
    } catch (e) {
      notifyError(t('page.stats.clearFailed', { error: String(e) }), {
        title: t('page.stats.clearFailedTitle')
      })
    } finally {
      setClearingStats(false)
      setShowClearConfirm(false)
    }
  }, [clearStats, t])

  return (
    <BasePage
      title={
        <div className="flex items-center gap-2">
          <span>{t('page.stats.title')}</span>
          <Button
            size="sm"
            variant="light"
            color="default"
            isIconOnly
            className="h-6 w-6 min-w-0 app-nodrag text-default-500"
            title={t('page.stats.clear')}
            isLoading={clearingStats}
            onPress={() => setShowClearConfirm(true)}
          >
            <MdOutlineCleaningServices className="text-base" />
          </Button>
        </div>
      }
    >
      {showClearConfirm && (
        <ConfirmModal
          onChange={setShowClearConfirm}
          title={t('page.stats.confirmClearTitle')}
          description={t('page.stats.confirmClearDescription')}
          confirmText={t('page.stats.confirmClear')}
          cancelText={t('common.cancel')}
          onConfirm={handleClearStats}
        />
      )}
      <div className="p-2 space-y-2">
        {/* Row 1: Status Grid */}
        <StatusGrid />

        {/* Row 2: Realtime traffic and live runtime curves */}
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
            <TrafficChart />
            <RealtimeMetricsPanel />
          </div>

          <TrafficRankingSection onSelectRule={setSelectedRule} />
        </div>

        {/* 规则命中详情弹窗 */}
        <RuleDetailsModalSection
          selectedRule={selectedRule}
          onClose={() => setSelectedRule(null)}
        />
      </div>
    </BasePage>
  )
}

export default Stats
