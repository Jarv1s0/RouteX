import React, { useState } from 'react'
import { Card, CardBody, Input, Button, Tabs, Tab, Chip } from '@heroui/react'
import { IoGlobe, IoSearch, IoLocation } from 'react-icons/io5'
import { mihomoDnsQuery } from '@renderer/utils/mihomo-ipc'
import { fetchBatchIpInfo } from '@renderer/utils/tools-ipc'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { useI18n } from '@renderer/i18n'

export const DnsQueryPanel: React.FC = () => {
  const { t } = useI18n()
  const [dnsQuery, setDnsQuery] = useState('')
  const [dnsType, setDnsType] = useState<'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT'>('A')
  const [dnsResult, setDnsResult] = useState<{ ip: string; country?: string; region?: string }[]>([])
  const [dnsLoading, setDnsLoading] = useState(false)
  const [dnsError, setDnsError] = useState<string | null>(null)

  const handleDnsQuery = async (): Promise<void> => {
    if (!dnsQuery.trim()) return
    setDnsLoading(true)
    setDnsError(null)
    setDnsResult([])
    try {
      const result = await mihomoDnsQuery(dnsQuery.trim(), dnsType)
      if (result.Answer && result.Answer.length > 0) {
        const ips = result.Answer.map((a) => a.data)
        // 自动查询归属地
        try {
          const geoInfos = await fetchBatchIpInfo(ips.map((ip) => ({ query: ip, lang: 'zh-CN' })))
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
          setDnsResult(ips.map((ip) => ({ ip })))
        }
      } else {
        setDnsError(t('tools.noDnsResult'))
      }
    } catch (e) {
      setDnsError(String(e))
    } finally {
      setDnsLoading(false)
    }
  }

  return (
    <Card className={`${CARD_STYLES.BASE} ${CARD_STYLES.INACTIVE} h-full hover:!scale-100 !cursor-default`}>
      <CardBody className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-primary/20">
            <IoGlobe className="text-primary text-lg" />
          </div>
          <span className="font-medium">{t('tools.dnsQuery')}</span>
          <span className="text-foreground-400 text-xs">{t('tools.dnsQueryHelp')}</span>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <Input
            size="sm"
            placeholder={t('tools.domainPlaceholder')}
            value={dnsQuery}
            onValueChange={setDnsQuery}
            onKeyDown={(e) => e.key === 'Enter' && handleDnsQuery()}
            className="flex-1"
            classNames={CARD_STYLES.GLASS_INPUT}
          />
          <Tabs
            classNames={{
              ...CARD_STYLES.GLASS_TABS,
              tabList: CARD_STYLES.GLASS_TABS.tabList + ' gap-1'
            }}
            selectedKey={dnsType}
            onSelectionChange={(key) => setDnsType(key as typeof dnsType)}
          >
            <Tab key="A" title="A" />
            <Tab key="AAAA" title="AAAA" />
            <Tab key="CNAME" title="CNAME" />
          </Tabs>
          <Button size="sm" color="primary" isLoading={dnsLoading} onPress={handleDnsQuery} isIconOnly>
            <IoSearch />
          </Button>
        </div>

        {dnsError && <div className="text-danger text-sm">{dnsError}</div>}

        {dnsResult.length > 0 && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
            {dnsResult.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-2 rounded-xl bg-default-100/50 border border-default-200/50"
              >
                <Chip size="sm" variant="flat" color="primary" className="h-6 shrink-0">
                  {dnsType}
                </Chip>
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
  )
}
