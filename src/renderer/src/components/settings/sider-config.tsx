import React from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { RadioGroup, Radio, Switch } from '@heroui/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
const titleMap = {
  sysproxyCardStatus: '系统代理',
  tunCardStatus: '虚拟网卡',
  profileCardStatus: '订阅管理',
  proxyCardStatus: '代理组',
  ruleCardStatus: '规则',
  resourceCardStatus: '外部资源',
  overrideCardStatus: '覆写',
  connectionCardStatus: '连接',
  mihomoCoreCardStatus: '内核',
  dnsCardStatus: 'DNS',
  sniffCardStatus: '域名嗅探',
  logCardStatus: '日志',
  mapCardStatus: '网络拓扑',
  substoreCardStatus: 'Sub-Store'
}
const SiderConfig: React.FC = () => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    enableSiderConfig = true,
    sysproxyCardStatus = 'col-span-1',
    tunCardStatus = 'col-span-1',
    profileCardStatus = 'col-span-2',
    proxyCardStatus = 'col-span-2',
    ruleCardStatus = 'col-span-1',
    resourceCardStatus = 'col-span-1',
    overrideCardStatus = 'col-span-1',
    connectionCardStatus = 'col-span-2',
    mihomoCoreCardStatus = 'col-span-2',
    dnsCardStatus = 'col-span-1',
    sniffCardStatus = 'col-span-1',
    logCardStatus = 'col-span-1',
    mapCardStatus = 'col-span-1',
    substoreCardStatus = 'col-span-1'
  } = appConfig || {}

  const cardStatus = {
    sysproxyCardStatus,
    tunCardStatus,
    profileCardStatus,
    proxyCardStatus,
    ruleCardStatus,
    resourceCardStatus,
    overrideCardStatus,
    connectionCardStatus,
    mihomoCoreCardStatus,
    dnsCardStatus,
    sniffCardStatus,
    logCardStatus,
    mapCardStatus,
    substoreCardStatus
  }

  return (
    <SettingCard title="侧边栏设置" collapsible>
      <SettingItem title="启用侧边栏设置" divider={enableSiderConfig}>
        <Switch
          size="sm"
          isSelected={enableSiderConfig}
          onValueChange={async (v) => {
            await patchAppConfig({ enableSiderConfig: v })
          }}
        />
      </SettingItem>
      {enableSiderConfig && (
        <div className="text-sm text-foreground-600 bg-content2/50 backdrop-blur-md rounded-xl p-4 mt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
            {Object.keys(cardStatus).map((key) => {
              return (
                <div key={key} className="flex items-center justify-between group py-1">
                  <span className="text-xs font-medium whitespace-nowrap text-foreground-500 group-hover:text-primary transition-colors pr-2">
                    {titleMap[key]}
                  </span>
                  <RadioGroup
                    orientation="horizontal"
                    size="sm"
                    value={cardStatus[key]}
                    onValueChange={(v) => {
                      patchAppConfig({ [key]: v as CardStatus })
                    }}
                    classNames={{
                      wrapper: "gap-1"
                    }}
                  >
                    <Radio value="col-span-2" classNames={{ label: "text-[10px]" }}>大</Radio>
                    <Radio value="col-span-1" classNames={{ label: "text-[10px]" }}>小</Radio>
                    <Radio value="hidden" classNames={{ label: "text-[10px]" }}>隐</Radio>
                  </RadioGroup>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </SettingCard>
  )
}

export default SiderConfig
