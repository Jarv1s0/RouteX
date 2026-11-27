import React, { useState, useCallback, useRef } from 'react'
import { Card, CardBody, Input, Button, Tabs, Tab, Chip } from '@heroui/react'
import { IoGlobe, IoSearch, IoLocation, IoCopy, IoCheckmarkCircle, IoShield } from 'react-icons/io5'
import * as isIp from 'is-ip'
import { mihomoDnsQuery } from '@renderer/utils/mihomo-ipc'
import { fetchBatchIpInfo } from '@renderer/utils/tools-ipc'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { useI18n } from '@renderer/i18n'

type DnsRecordType = 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT'

interface DnsResultItem {
  value: string
  isIpAddress: boolean
  country?: string
  region?: string
}

function extractHostname(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  try {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
      return new URL(trimmed).hostname
    }
  } catch {
    // 非标准 URL 时回退到原始字符串处理
  }
  return trimmed.split('/')[0].split(':')[0].trim()
}

interface DnsQueryPanelProps {
  onTestRule?: (domain: string) => void
  onInspectIp?: (ip: string) => void
}

export const DnsQueryPanel: React.FC<DnsQueryPanelProps> = ({ onTestRule, onInspectIp }) => {
  const { t } = useI18n()
  const [dnsQuery, setDnsQuery] = useState('')
  const [dnsType, setDnsType] = useState<DnsRecordType>('A')
  const [dnsResult, setDnsResult] = useState<DnsResultItem[]>([])
  const [dnsLoading, setDnsLoading] = useState(false)
  const [dnsError, setDnsError] = useState<string | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const queryIdRef = useRef(0)

  const runDnsQuery = useCallback(
    async (rawInput: string, recordType: DnsRecordType): Promise<void> => {
      const domain = extractHostname(rawInput)
      if (!domain) return
      const queryId = ++queryIdRef.current
      if (domain !== rawInput.trim()) {
        setDnsQuery(domain)
      }
      setDnsLoading(true)
      setDnsError(null)
      setDnsResult([])
      try {
        const result = await mihomoDnsQuery(domain, recordType)
        if (queryId !== queryIdRef.current) return
        if (result.Answer && result.Answer.length > 0) {
          const items: DnsResultItem[] = result.Answer.map((a) => ({
            value: a.data,
            isIpAddress: isIp.isIP(a.data)
          }))

          const ipItems = items.filter((item) => item.isIpAddress)
          if (ipItems.length > 0) {
            try {
              const geoInfos = await fetchBatchIpInfo(
                ipItems.map((item) => ({ query: item.value, lang: 'zh-CN' }))
              )
              if (queryId !== queryIdRef.current) return
              let geoCursor = 0
              const enriched = items.map((item) => {
                if (!item.isIpAddress) return item
                const geo = geoInfos[geoCursor++]
                return {
                  ...item,
                  country: geo?.status === 'success' ? geo.country : undefined,
                  region: geo?.status === 'success' ? geo.regionName : undefined
                }
              })
              setDnsResult(enriched)
            } catch {
              if (queryId !== queryIdRef.current) return
              setDnsResult(items)
            }
          } else {
            setDnsResult(items)
          }
        } else {
          setDnsError(t('tools.noDnsResult'))
        }
      } catch (e) {
        if (queryId !== queryIdRef.current) return
        setDnsError(e instanceof Error ? e.message : String(e))
      } finally {
        if (queryId === queryIdRef.current) setDnsLoading(false)
      }
    },
    [t]
  )

  const handleDnsQuery = (): void => {
    void runDnsQuery(dnsQuery, dnsType)
  }

  const handleTypeChange = (key: React.Key): void => {
    const nextType = key as DnsRecordType
    setDnsType(nextType)
    if (dnsQuery.trim()) {
      void runDnsQuery(dnsQuery, nextType)
    }
  }

  const handleCopy = async (value: string, index: number): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      // 忽略剪贴板权限异常
    }
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex((prev) => (prev === index ? null : prev)), 1200)
  }

  const normalizedDomain = extractHostname(dnsQuery)

  return (
    <Card
      className={`${CARD_STYLES.BASE} ${CARD_STYLES.INACTIVE} h-full hover:!scale-100 !cursor-default`}
    >
      <CardBody className="p-2.5 flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-primary/20 shrink-0">
              <IoGlobe className="text-primary text-base" />
            </div>
            <span className="font-medium text-sm shrink-0">{t('tools.dnsQuery')}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Tabs
              size="sm"
              classNames={{
                ...CARD_STYLES.GLASS_TABS,
                tabList: CARD_STYLES.GLASS_TABS.tabList + ' gap-0.5',
                tab: 'h-7 px-2 text-xs'
              }}
              selectedKey={dnsType}
              onSelectionChange={handleTypeChange}
            >
              <Tab key="A" title="A" />
              <Tab key="AAAA" title="AAAA" />
              <Tab key="CNAME" title="CNAME" />
              <Tab key="MX" title="MX" />
              <Tab key="TXT" title="TXT" />
            </Tabs>
            {onTestRule && normalizedDomain && (
              <Button
                size="sm"
                variant="light"
                color="warning"
                className="h-7 px-2 text-xs shrink-0"
                startContent={<IoShield className="text-sm" />}
                onPress={() => onTestRule(normalizedDomain)}
              >
                {t('tools.testRuleForDomain')}
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Input
            size="sm"
            placeholder={t('tools.domainPlaceholder')}
            value={dnsQuery}
            onValueChange={setDnsQuery}
            onKeyDown={(e) => e.key === 'Enter' && handleDnsQuery()}
            className="flex-1 min-w-0"
            classNames={CARD_STYLES.GLASS_INPUT}
          />
          <Button
            size="sm"
            color="primary"
            isLoading={dnsLoading}
            onPress={handleDnsQuery}
            isIconOnly
            className="shrink-0"
          >
            <IoSearch />
          </Button>
        </div>

        {dnsError && <div className="text-danger text-sm">{dnsError}</div>}

        {dnsResult.length > 0 && (
          <div className="space-y-1.5 animate-fade-in-up">
            {dnsResult.map((item, i) => (
              <div
                key={`${item.value}-${i}`}
                className="flex items-center justify-between gap-2 p-2 rounded-xl bg-default-100/50 border border-default-200/50"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Chip size="sm" variant="flat" color="primary" className="h-6 shrink-0">
                    {dnsType}
                  </Chip>
                  <span className="font-mono text-sm select-all truncate" title={item.value}>
                    {item.value}
                  </span>
                  {(item.country || item.region) && (
                    <div className="flex items-center gap-1 shrink-0">
                      <IoLocation className="text-primary-500 text-sm" />
                      <span className="text-xs text-primary-600 dark:text-primary-400 font-semibold">
                        {item.country} {item.region}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {item.isIpAddress && onInspectIp && (
                    <Button
                      size="sm"
                      isIconOnly
                      variant="light"
                      className="h-6 w-6 min-w-6"
                      onPress={() => onInspectIp(item.value)}
                      title={t('tools.inspectIp')}
                    >
                      <IoLocation className="text-xs text-primary" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    isIconOnly
                    variant="light"
                    color={copiedIndex === i ? 'success' : 'default'}
                    className="h-6 w-6 min-w-6"
                    onPress={() => void handleCopy(item.value, i)}
                    title={t('common.copy')}
                  >
                    {copiedIndex === i ? (
                      <IoCheckmarkCircle className="text-xs" />
                    ) : (
                      <IoCopy className="text-xs text-foreground/60" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
