import { Button, Card, CardBody } from '@heroui/react'
import { mihomoUnfixedProxy } from '@renderer/utils/ipc'
import React, { useMemo, useState, memo } from 'react'
import { FaMapPin } from 'react-icons/fa6'
import { useAppConfig } from '@renderer/hooks/use-app-config'

interface Props {
  mutateProxies: () => void
  onProxyDelay: (proxy: string, url?: string) => Promise<ControllerProxiesDelay>
  proxyDisplayLayout: 'hidden' | 'single' | 'double'
  proxy: ControllerProxiesDetail | ControllerGroupDetail
  group: ControllerMixedGroup
  onSelect: (group: string, proxy: string) => void
  selected: boolean
  index?: number
}

// 检查是否是子组（有 all 属性且是数组）
const isSubGroup = (proxy: ControllerProxiesDetail | ControllerGroupDetail): proxy is ControllerGroupDetail => {
  return 'all' in proxy && Array.isArray((proxy as ControllerGroupDetail).all) && (proxy as ControllerGroupDetail).all.length > 0
}

const ProxyItemComponent: React.FC<Props> = (props) => {
  const {
    mutateProxies,
    proxyDisplayLayout,
    group,
    proxy,
    selected,
    onSelect,
    onProxyDelay
  } = props

  const { appConfig } = useAppConfig()
  const { delayThresholds = { good: 200, fair: 500 } } = appConfig || {}

  const delay = useMemo(() => {
    if (proxy.history && proxy.history.length > 0) {
      return proxy.history[proxy.history.length - 1].delay
    }
    return -1
  }, [proxy])

  // 如果是子组，获取当前选中节点的信息和延迟
  const subGroupInfo = useMemo(() => {
    if (!isSubGroup(proxy)) return null
    const subGroup = proxy as ControllerGroupDetail
    // 子组自身的延迟（从子组的 history 获取）
    const subGroupDelay = subGroup.history?.length 
      ? subGroup.history[subGroup.history.length - 1].delay 
      : -1
    return {
      now: subGroup.now,
      nodeCount: subGroup.all.length,
      currentNodeDelay: subGroupDelay
    }
  }, [proxy])

  // 显示的延迟：如果是子组，显示当前选中节点的延迟
  const displayDelay = useMemo(() => {
    if (subGroupInfo) {
      return subGroupInfo.currentNodeDelay
    }
    return delay
  }, [subGroupInfo, delay])

  const [loading, setLoading] = useState(false)

  function delayColor(delay: number): 'primary' | 'success' | 'warning' | 'danger' {
    if (delay === -1) return 'primary'
    if (delay === 0) return 'danger'
    if (delay < delayThresholds.good) return 'success'
    if (delay < delayThresholds.fair) return 'warning'
    return 'danger'
  }

  function delayText(delay: number): string {
    if (delay === -1) return '测试'
    if (delay === 0) return '超时'
    return delay.toString()
  }

  const onDelay = (): void => {
    setLoading(true)
    onProxyDelay(proxy.name, group.testUrl).finally(() => {
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
        ${fixed 
          ? 'bg-secondary/20 backdrop-blur-md border border-secondary/50' 
          : selected 
            ? 'bg-primary/15 backdrop-blur-xl border border-primary/40 shadow-[0_0_15px_rgba(var(--heroui-primary),0.1)]' 
            : 'bg-default-100/60 dark:bg-default-50/30 backdrop-blur-md border border-default-200/60 dark:border-white/10 hover:bg-default-200/60 dark:hover:bg-default-100/40 hover:-translate-y-0.5 hover:shadow-md'
        } 
        ${displayDelay === 0 ? 'opacity-70 grayscale-[30%] hover:grayscale-0' : ''}
        transition-all duration-200 border
      `}
      radius="lg"
    >
      <CardBody className="py-1.5 px-2">
        <div
          className={`flex ${proxyDisplayLayout === 'double' ? 'gap-1' : 'justify-between items-center'}`}
        >
          {proxyDisplayLayout === 'double' ? (
            <>
              <div className="flex flex-col gap-0 flex-1 min-w-0">
                <div className="flex-1 min-w-0 overflow-hidden whitespace-nowrap text-sm flex items-center gap-1">
                  {proxy.icon && (
                    <img
                      className={`w-4 h-4 object-contain ${displayDelay === 0 ? 'opacity-50' : ''}`}
                      src={proxy.icon}
                      alt=""
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  )}
                  <span className="flag-emoji" title={proxy.name}>
                    {proxy.name}
                  </span>
                </div>
                <div className="text-[12px] text-foreground-500 leading-none mt-0.5 flex items-center gap-2">
                  <span>{proxy.type === 'Compatible' ? 'Direct' : proxy.type}</span>
                  {subGroupInfo && (
                    <>
                      <span className="text-foreground-400">|</span>
                      <span className="flag-emoji truncate text-foreground-600" title={subGroupInfo.now}>{subGroupInfo.now}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-center gap-0.5 shrink-0">
                {fixed && (
                  <Button
                    isIconOnly
                    title="取消固定"
                    color="danger"
                    onPress={async () => {
                      await mihomoUnfixedProxy(group.name)
                      mutateProxies()
                    }}
                    variant="light"
                    className="h-[24px] w-[24px] min-w-[24px] p-0 text-xs"
                  >
                    <FaMapPin className="text-xs le" />
                  </Button>
                )}
                <Button
                  title={proxy.type}
                  isDisabled={loading}
                  color={delayColor(displayDelay)}
                  onPress={onDelay}
                  variant="light"
                  className="h-[28px] min-w-[48px] px-2 p-0 text-[11px] font-mono font-bold hover:bg-default-100/50"
                >
                   {loading ? (
                    <div className="w-3.5 h-3.5 rounded-full border-[1.5px] border-current border-t-transparent animate-spin opacity-70" />
                  ) : (
                    delayText(displayDelay)
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex-1 min-w-0 overflow-hidden whitespace-nowrap text-sm flex items-center gap-1">
                {proxy.icon && (
                  <img
                    className={`w-4 h-4 object-contain ${displayDelay === 0 ? 'opacity-50' : ''}`}
                    src={proxy.icon}
                    alt=""
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                )}
                <span className="flag-emoji" title={proxy.name}>
                  {proxy.name === 'COMPATIBLE' ? 'DIRECT' : proxy.name}
                </span>
                {proxyDisplayLayout === 'single' && (
                  <span className="ml-2 text-foreground-500" title={proxy.type}>
                    {proxy.type === 'Compatible' ? 'Direct' : proxy.type}
                  </span>
                )}
                {subGroupInfo && (
                  <>
                    <span className="text-foreground-400 ml-1">|</span>
                    <span className="ml-1 text-foreground-600 flag-emoji" title={subGroupInfo.now}>
                      {subGroupInfo.now}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                {fixed && (
                  <div className="flex items-center">
                    <Button
                      isIconOnly
                      title="取消固定"
                      color="danger"
                      onPress={async () => {
                        await mihomoUnfixedProxy(group.name)
                        mutateProxies()
                      }}
                      variant="light"
                      className="h-[24px] w-[24px] min-w-[24px] p-0 text-xs"
                    >
                      <FaMapPin className="text-xs le" />
                    </Button>
                  </div>
                )}
                <div className="flex items-center">
                  <Button
                    title={proxy.type}
                    isDisabled={loading}
                    color={delayColor(displayDelay)}
                    onPress={onDelay}
                    variant="light"
                    className="h-[30px] min-w-[48px] px-2 p-0 text-xs font-mono font-bold hover:bg-default-100/50"
                  >
                    {loading ? (
                      <div className="w-4 h-4 rounded-full border-[1.5px] border-current border-t-transparent animate-spin opacity-70" />
                    ) : (
                      delayText(displayDelay)
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
    const isPrevSelected = prev.group.now === prev.proxy.name
    const isNextSelected = next.group.now === next.proxy.name
    
    return (
        isPrevSelected === isNextSelected &&
        prev.selected === next.selected &&
        prev.proxyDisplayLayout === next.proxyDisplayLayout &&
        prev.group.fixed === next.group.fixed &&
        prev.proxy === next.proxy && 
        prev.index === next.index
    )
})

export default ProxyItem
