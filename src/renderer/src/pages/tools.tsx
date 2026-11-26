import React, { useState, useCallback } from 'react'
import BasePage from '@renderer/components/base/base-page'
import { DnsQueryPanel } from '@renderer/components/tools/dns-query-panel'
import { RuleTestPanel } from '@renderer/components/tools/rule-test-panel'
import { ConnectivityTestPanel } from '@renderer/components/tools/connectivity-test-panel'
import { IpInfoPanel } from '@renderer/components/tools/ip-info-panel'
import { useI18n } from '@renderer/i18n'

const Tools: React.FC = () => {
  const { t } = useI18n()
  const [ruleQueryRequest, setRuleQueryRequest] = useState<{
    domain: string
    trigger: number
  } | null>(null)
  const [ipQueryRequest, setIpQueryRequest] = useState<{
    query: string
    trigger: number
  } | null>(null)

  const handleTestRule = useCallback((domain: string) => {
    setRuleQueryRequest((prev) => ({
      domain,
      trigger: (prev?.trigger ?? 0) + 1
    }))
  }, [])

  const handleInspectIp = useCallback((ip: string) => {
    setIpQueryRequest((prev) => ({
      query: ip,
      trigger: (prev?.trigger ?? 0) + 1
    }))
  }, [])

  return (
    <BasePage title={t('page.tools.title')}>
      <div className="p-2 space-y-2">
        {/* IP 信息与主动查询 */}
        <IpInfoPanel externalQuery={ipQueryRequest} />

        {/* 网络与流媒体检测 */}
        <ConnectivityTestPanel />

        {/* DNS 查询与规则测试联动 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          <DnsQueryPanel onTestRule={handleTestRule} onInspectIp={handleInspectIp} />
          <RuleTestPanel externalQuery={ruleQueryRequest} />
        </div>
      </div>
    </BasePage>
  )
}

export default Tools
