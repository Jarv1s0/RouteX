import React, { useState, useCallback } from 'react'
import BasePage from '@renderer/components/base/base-page'
import { Button, Modal, ModalContent, ModalHeader, ModalBody } from '@heroui/react'
import { clearTrafficStats, clearProviderStats } from '@renderer/utils/ipc'

import { IoClose } from 'react-icons/io5'
import { CgTrash } from 'react-icons/cg'
import ConfirmModal from '@renderer/components/base/base-confirm'


import StatusGrid from '@renderer/components/stats/status-grid'
import TrafficChart from '@renderer/components/stats/traffic-chart'
import ProviderUsage from '@renderer/components/stats/provider-usage'
import TrafficRanking from '@renderer/components/stats/traffic-ranking'
import RuleDetailList from '@renderer/components/stats/rule-detail-list'
import { useTrafficStore } from '@renderer/store/use-traffic-store'

const Stats: React.FC = () => {
  const {
    trafficHistory,
    hourlyData,
    dailyData,
    sessionStats,
    providerData,
    currentProviders,
    ruleStats,
    ruleHitDetails,
    refreshProviderStats,
    clearStats
  } = useTrafficStore()
  
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
      alert('清除失败: ' + e)
    } finally {
      setClearingStats(false)
      setShowClearConfirm(false)
    }
  }, [clearStats])

  // 刷新订阅数据
  const handleRefreshProviderStats = useCallback(async () => {
    await refreshProviderStats()
  }, [refreshProviderStats])

  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const todayStats = dailyData.find(d => d.date === today) || { upload: 0, download: 0 }

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
          <TrafficChart 
            trafficHistory={trafficHistory}
            hourlyData={hourlyData}
            dailyData={dailyData}
          />
          
          {/* Traffic Ranking (Merged) */}
          <TrafficRanking 
            session={sessionStats}
            today={todayStats}
            ruleStats={ruleStats}
            ruleHitDetails={ruleHitDetails}
            onSelectRule={setSelectedRule}
          />

          {/* Provider Usage */}
          <ProviderUsage 
            providerData={providerData}
            currentProviders={currentProviders}
            onRefresh={handleRefreshProviderStats}
          />
        </div>

        {/* 规则命中详情弹窗 */}
        <Modal 
          isOpen={!!selectedRule} 
          onClose={() => setSelectedRule(null)} 
          size="2xl" 
          backdrop="blur"
          hideCloseButton
          classNames={{
             base: 'bg-background/60 dark:bg-default-100/50 backdrop-blur-xl border border-default-200/50 shadow-2xl',
             header: 'border-b border-default-100/50',
             body: 'py-6',
             backdrop: 'bg-black/40 backdrop-blur-sm'
          }}
        >
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className="flex flex-col gap-1">
                  <div className="flex flex-col gap-1 pr-8">
                     <span>规则详情: {selectedRule}</span>
                  </div>
                  <Button 
                     isIconOnly 
                     size="sm" 
                     variant="light" 
                     onPress={onClose}
                     className="absolute right-4 top-4"
                  >
                     <IoClose size={20} />
                  </Button>
                </ModalHeader>
                <ModalBody>
                  <div className="space-y-4">
                     <div className="flex justify-between items-center">
                        <span className="text-sm text-foreground-500">最近命中记录 (Top 50)</span>
                        <span className="text-xs text-foreground-400 bg-default-100 px-2 py-1 rounded-md">
                           按时间倒序
                        </span>
                     </div>
                     <RuleDetailList details={(ruleHitDetails.get(selectedRule || '') || []).slice(0, 50)} />
                  </div>
                </ModalBody>
              </>
            )}
          </ModalContent>
        </Modal>
      </div>
    </BasePage>
  )
}

export default Stats
