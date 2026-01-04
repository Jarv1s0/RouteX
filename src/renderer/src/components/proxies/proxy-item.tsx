import { Button, Card, CardBody } from '@heroui/react'
import { mihomoUnfixedProxy } from '@renderer/utils/ipc'
import React, { useMemo, useState } from 'react'
import { FaMapPin } from 'react-icons/fa6'
import { motion } from 'framer-motion'
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

const MotionCard = motion.create(Card)

const ProxyItem: React.FC<Props> = (props) => {
  const {
    mutateProxies,
    proxyDisplayLayout,
    group,
    proxy,
    selected,
    onSelect,
    onProxyDelay,
    index = 0
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
    // 从 group.all 中找到当前选中的节点
    const currentNode = group.all.find(p => p.name === subGroup.now)
    // 获取当前节点的延迟
    const currentNodeDelay = currentNode?.history?.length 
      ? currentNode.history[currentNode.history.length - 1].delay 
      : -1
    return {
      now: subGroup.now,
      currentNode,
      nodeCount: subGroup.all.length,
      currentNodeDelay
    }
  }, [proxy, group.all])

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
    if (delay < delayThresholds.fair) return 'success'
    return 'warning'
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
    <MotionCard
      as="div"
      onPress={() => onSelect(group.name, proxy.name)}
      isPressable
      fullWidth
      shadow="sm"
      className={`${fixed ? 'bg-secondary/30' : selected ? 'bg-primary/30' : 'bg-content2 hover:bg-primary/10'} ${loading ? 'animate-pulse' : ''} transition-colors`}
      radius="sm"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{
        opacity: 1,
        scale: selected ? 1.02 : 1,
        transition: { duration: 0.15, delay: Math.min(index * 0.02, 0.3) }
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <CardBody className="py-1.5 px-2">
        <div
          className={`flex ${proxyDisplayLayout === 'double' ? 'gap-1' : 'justify-between items-center'}`}
        >
          {proxyDisplayLayout === 'double' ? (
            <>
              <div className="flex flex-col gap-0 flex-1 min-w-0">
                <div className="text-ellipsis overflow-hidden whitespace-nowrap text-sm flex items-center gap-1">
                  {proxy.icon && (
                    <img
                      className="w-4 h-4 object-contain"
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
                  isIconOnly
                  title={proxy.type}
                  isLoading={loading}
                  color={delayColor(displayDelay)}
                  onPress={onDelay}
                  variant="light"
                  className="h-[32px] w-[32px] min-w-[32px] p-0 text-xs"
                >
                  {delayText(displayDelay)}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="text-ellipsis overflow-hidden whitespace-nowrap text-sm flex items-center gap-1">
                {proxy.icon && (
                  <img
                    className="w-4 h-4 object-contain"
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
                    isIconOnly
                    title={proxy.type}
                    isLoading={loading}
                    color={delayColor(displayDelay)}
                    onPress={onDelay}
                    variant="light"
                    className="h-full w-[32px] min-w-[32px] p-0 text-sm"
                  >
                    {delayText(displayDelay)}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </CardBody>
    </MotionCard>
  )
}

export default ProxyItem
