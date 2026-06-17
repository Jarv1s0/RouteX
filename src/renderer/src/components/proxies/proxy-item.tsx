import { Button, Card, CardBody } from '@heroui/react'
import { mihomoUnfixedProxy } from '@renderer/utils/mihomo-ipc'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import React, { useMemo, useState, memo } from 'react'
import { FaMapPin } from 'react-icons/fa6'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { getProxyDisplayDelay, getResolvedProxyTarget } from '@renderer/utils/proxy-delay'
import { useI18n } from '@renderer/i18n'
import { getDelayColorClass } from '@renderer/utils/delay-color'

interface Props {
  mutateProxies: () => void
  onProxyDelay: (proxy: string, url?: string) => Promise<ControllerProxiesDelay>
  proxyDisplayLayout: 'hidden' | 'single' | 'double'
  proxy: ControllerProxiesDetail | ControllerGroupDetail
  group: ControllerMixedGroup
  delayVersion: string
  onSelect: (group: string, proxy: string) => void
  selected: boolean
  index?: number
}

// 检查是否是子组（有 all 属性且是数组）
const isSubGroup = (
  proxy: ControllerProxiesDetail | ControllerGroupDetail
): proxy is ControllerGroupDetail => {
  return (
    'all' in proxy &&
    Array.isArray((proxy as ControllerGroupDetail).all) &&
    (proxy as ControllerGroupDetail).all.length > 0
  )
}

function getProxyNow(proxy: ControllerProxiesDetail | ControllerGroupDetail): string | undefined {
  return 'now' in proxy ? proxy.now : undefined
}

function getProxyTestUrl(
  proxy: ControllerProxiesDetail | ControllerGroupDetail
): string | undefined {
  return 'testUrl' in proxy ? proxy.testUrl : undefined
}

const ProxyItemComponent: React.FC<Props> = (props) => {
  const {
    mutateProxies,
    proxyDisplayLayout,
    group,
    proxy,
    selected,
    onSelect,
    onProxyDelay,
    delayVersion
  } = props

  const { t } = useI18n()
  const { appConfig } = useAppConfig()
  const { delayThresholds = { good: 200, fair: 500 } } = appConfig || {}

  const displayDelay = useMemo(() => getProxyDisplayDelay(proxy), [proxy, delayVersion])

  // 如果是子组，获取当前选中节点的信息和延迟
  const subGroupInfo = useMemo(() => {
    if (!isSubGroup(proxy)) return null
    const subGroup = proxy as ControllerGroupDetail
    return {
      now: subGroup.now,
      nodeCount: subGroup.all.length
    }
  }, [proxy, delayVersion])

  const [loading, setLoading] = useState(false)

  function delayText(delay: number): string {
    if (delay === -1) return t('proxies.test')
    if (delay === 0) return t('proxies.timeout')
    return delay.toString()
  }

  const onDelay = (): void => {
    setLoading(true)
    const target = getResolvedProxyTarget(proxy)
    const testUrl = isSubGroup(proxy) ? (proxy.testUrl ?? group.testUrl) : group.testUrl
    onProxyDelay(target?.name ?? proxy.name, testUrl).finally(() => {
      mutateProxies()
      setLoading(false)
    })
  }

  const fixed = group.fixed && group.fixed === proxy.name

  return (
    <Card
      as="div"
      onPress={() => onSelect(group.name, proxy.name)}
      isPressable
      fullWidth
      shadow="none"
      className={`
        ${
          fixed
            ? 'bg-secondary/10 border border-secondary/40 shadow-sm'
            : selected
              ? 'bg-primary/10 dark:bg-primary/15 border-primary/30 dark:border-primary/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_12px_rgba(var(--heroui-primary)/0.15)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_2px_12px_rgba(var(--heroui-primary)/0.2)] backdrop-blur-md z-10'
              : CARD_STYLES.PROXY_ITEM_CARD
        } 
        border transition-all duration-300 ease-out
        ${displayDelay === 0 ? 'opacity-70 grayscale-[30%] hover:grayscale-0' : ''}
        ${CARD_STYLES.BASE} data-[pressed=true]:scale-[0.98]
      `}
      radius="lg"
    >
      <CardBody className="py-2 px-2.5">
        <div
          className={`flex ${proxyDisplayLayout === 'double' ? 'gap-1' : 'justify-between items-center'}`}
        >
          {proxyDisplayLayout === 'double' ? (
            <>
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <div className="flex-1 min-w-0 overflow-hidden whitespace-nowrap text-sm flex items-center gap-1.5">
                  {proxy.icon && (
                    <img
                      className={`w-4 h-4 object-contain drop-shadow-sm ${displayDelay === 0 ? 'opacity-50' : ''}`}
                      src={proxy.icon}
                      alt=""
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  )}
                  <span
                    className="flag-emoji font-semibold tracking-wide text-[12.5px] text-foreground/90"
                    title={proxy.name}
                  >
                    {proxy.name}
                  </span>
                </div>
                <div className="mt-0.5 flex min-h-5 items-center gap-1.5 leading-5 opacity-90">
                  <span className="inline-flex h-[18px] items-center rounded bg-default-100/80 dark:bg-white/5 px-1.5 text-[9px] font-bold uppercase tracking-wider text-default-500/80 dark:text-default-400">
                    {proxy.type === 'Compatible' ? 'Direct' : proxy.type}
                  </span>
                  {subGroupInfo && (
                    <>
                      <span className="text-default-300 dark:text-default-600/50 text-[10px]">
                        |
                      </span>
                      <span
                        className="flag-emoji truncate text-[11px] font-medium tracking-wide leading-5 text-default-500"
                        title={subGroupInfo.now}
                      >
                        {subGroupInfo.now}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div
                className="flex items-center justify-center gap-1 shrink-0"
                onClick={(event) => event.stopPropagation()}
              >
                {fixed && (
                  <Button
                    isIconOnly
                    title={t('proxies.unfix')}
                    color="danger"
                    onPress={async () => {
                      await mihomoUnfixedProxy(group.name)
                      mutateProxies()
                    }}
                    variant="flat"
                    className="h-[26px] w-[26px] min-w-[26px] p-0 text-xs"
                  >
                    <FaMapPin className="text-xs" />
                  </Button>
                )}
                <Button
                  title={proxy.type}
                  isDisabled={loading}
                  onPress={onDelay}
                  variant="light"
                  className="h-[26px] min-w-[48px] px-2 p-0 text-[11.5px] font-mono font-bold tracking-tight hover:bg-default-100/50 transition-all"
                >
                  {loading ? (
                    <div className="w-3.5 h-3.5 rounded-full border-[1.5px] border-current border-t-transparent animate-spin opacity-70" />
                  ) : (
                    <span
                      className={getDelayColorClass(
                        displayDelay,
                        delayThresholds,
                        'text-default-500'
                      )}
                    >
                      {delayText(displayDelay)}
                    </span>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex-1 min-w-0 overflow-hidden whitespace-nowrap text-sm flex items-center gap-1.5">
                {proxy.icon && (
                  <img
                    className={`w-4 h-4 object-contain drop-shadow-sm ${displayDelay === 0 ? 'opacity-50' : ''}`}
                    src={proxy.icon}
                    alt=""
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                )}
                <span
                  className="flag-emoji font-semibold tracking-wide text-[13px] text-foreground/90"
                  title={proxy.name}
                >
                  {proxy.name === 'COMPATIBLE' ? 'DIRECT' : proxy.name}
                </span>
                {proxyDisplayLayout === 'single' && (
                  <span
                    className="ml-2 inline-flex h-[18px] items-center rounded bg-default-100/80 dark:bg-white/5 px-1.5 text-[9px] font-bold uppercase tracking-wider text-default-500/80 dark:text-default-400"
                    title={proxy.type}
                  >
                    {proxy.type === 'Compatible' ? 'Direct' : proxy.type}
                  </span>
                )}
                {subGroupInfo && (
                  <>
                    <span className="text-default-300 dark:text-default-600/50 text-[10px] ml-2">
                      |
                    </span>
                    <span
                      className="ml-1.5 text-[11.5px] font-medium tracking-wide text-default-500 flag-emoji truncate"
                      title={subGroupInfo.now}
                    >
                      {subGroupInfo.now}
                    </span>
                  </>
                )}
              </div>
              <div
                className="flex items-center gap-1 shrink-0 pl-2"
                onClick={(event) => event.stopPropagation()}
              >
                {fixed && (
                  <div className="flex items-center">
                    <Button
                      isIconOnly
                      title={t('proxies.unfix')}
                      color="danger"
                      onPress={async () => {
                        await mihomoUnfixedProxy(group.name)
                        mutateProxies()
                      }}
                      variant="flat"
                      className="h-[26px] w-[26px] min-w-[26px] p-0 text-xs"
                    >
                      <FaMapPin className="text-xs" />
                    </Button>
                  </div>
                )}
                <div className="flex items-center">
                  <Button
                    title={proxy.type}
                    isDisabled={loading}
                    onPress={onDelay}
                    variant="light"
                    className="h-[26px] min-w-[48px] px-2 p-0 text-[11.5px] font-mono font-bold tracking-tight hover:bg-default-100/50 transition-all"
                  >
                    {loading ? (
                      <div className="w-3.5 h-3.5 rounded-full border-[1.5px] border-current border-t-transparent animate-spin opacity-70" />
                    ) : (
                      <span
                        className={getDelayColorClass(
                          displayDelay,
                          delayThresholds,
                          'text-default-500'
                        )}
                      >
                        {delayText(displayDelay)}
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

const ProxyItem = memo(ProxyItemComponent, (prev, next) => {
  // 精细化阻断不必要渲染。比如测速或者选择了其他节点，不要带动我这颗没变的节点重绘
  const prevDelay = getProxyDisplayDelay(prev.proxy)
  const nextDelay = getProxyDisplayDelay(next.proxy)

  return (
    prev.selected === next.selected &&
    prev.proxyDisplayLayout === next.proxyDisplayLayout &&
    prev.delayVersion === next.delayVersion &&
    prev.group.fixed === next.group.fixed &&
    prev.group.name === next.group.name &&
    prev.group.testUrl === next.group.testUrl &&
    getProxyTestUrl(prev.proxy) === getProxyTestUrl(next.proxy) &&
    prev.proxy.name === next.proxy.name &&
    prev.proxy.type === next.proxy.type &&
    prev.proxy.icon === next.proxy.icon &&
    getProxyNow(prev.proxy) === getProxyNow(next.proxy) &&
    prevDelay === nextDelay &&
    prev.index === next.index
  )
})

export default ProxyItem
