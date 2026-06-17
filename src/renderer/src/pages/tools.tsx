import React, { useState } from 'react'
import BasePage from '@renderer/components/base/base-page'
import { DnsQueryPanel } from '@renderer/components/tools/dns-query-panel'
import { RuleTestPanel } from '@renderer/components/tools/rule-test-panel'
import { ConnectivityTestPanel } from '@renderer/components/tools/connectivity-test-panel'
import { IpInfoPanel } from '@renderer/components/tools/ip-info-panel'
import { useI18n } from '@renderer/i18n'

const Tools: React.FC = () => {
  const { t } = useI18n()
  const [showIp, setShowIp] = useState(false)

  return (
    <BasePage title={t('page.tools.title')}>
      <div className="p-2 space-y-2">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {/* DNS 查询 */}
          <DnsQueryPanel />
          {/* 规则测试 */}
          <RuleTestPanel />
        </div>

        {/* 网络与服务检测 */}
        <ConnectivityTestPanel />

        {/* IP 信息 */}
        <IpInfoPanel showIp={showIp} setShowIp={setShowIp} />
      </div>
    </BasePage>
  )
}

export default Tools
