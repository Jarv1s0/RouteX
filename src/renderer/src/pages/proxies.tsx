import { Button } from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import EmptyState from '@renderer/components/base/empty-state'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import {
  mihomoChangeProxy,
  mihomoCloseAllConnections,
  mihomoProxyDelay,
  mihomoGroupDelay
} from '@renderer/utils/ipc'
import { useEffect, useMemo, useRef, useState, useCallback, useDeferredValue, memo } from 'react'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import ProxyItem from '@renderer/components/proxies/proxy-item'
import ProxySettingModal from '@renderer/components/proxies/proxy-setting-modal'
import ProxyChainModal from '@renderer/components/proxies/proxy-chain-modal'
import { MdTune, MdLink } from 'react-icons/md'
import { TbBolt } from 'react-icons/tb'
import { useGroups } from '@renderer/hooks/use-groups'
import { includesIgnoreCase } from '@renderer/utils/includes'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { ProxyGroupCard } from '@renderer/components/proxies/proxy-group-card'
import { ProxyCardSkeleton } from '@renderer/components/base/skeleton'

// ----------------------------------------
// ProxyRowChunk: 独立的 Grid 块渲染组件，用于性能优化
// ----------------------------------------
interface ProxyRowChunkProps {
  proxies: (ControllerProxiesDetail | ControllerGroupDetail)[]
  group: ControllerMixedGroup
  isAuto: boolean
  chunkSize: number
  mutate: () => void
  onProxyDelay: (proxy: string, url?: string) => Promise<ControllerProxiesDelay>
  onChangeProxy: (group: string, proxy: string) => Promise<void>
  proxyDisplayLayout: 'hidden' | 'single' | 'double'
}

const ProxyRowChunk = memo(
  ({
    proxies,
    group,
    isAuto,
    chunkSize,
    mutate,
    onProxyDelay,
    onChangeProxy,
    proxyDisplayLayout
  }: ProxyRowChunkProps) => {
    return (
      <div
        style={
          !isAuto
            ? { gridTemplateColumns: `repeat(${chunkSize}, minmax(0, 1fr))` }
            : {}
        }
        className={`w-full grid ${
          isAuto
            ? 'grid-cols-[repeat(auto-fill,minmax(200px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]'
            : ''
        } gap-2 px-2 pt-2 pb-1`}
      >
        {proxies.map((proxy, i) => {
          if (!proxy) return null
          return (
            <ProxyItem
              key={proxy.name}
              mutateProxies={mutate}
              onProxyDelay={onProxyDelay}
              onSelect={onChangeProxy}
              proxy={proxy}
              group={group}
              proxyDisplayLayout={proxyDisplayLayout}
              selected={proxy.name === group.now}
              index={i}
            />
          )
        })}
      </div>
    )
  },
  (prev, next) => {
    // 粗略比较，只有同名节点、选择状态及布局配置发生变化时重渲染。
    // 由于外部 mutate 会刷新整个引用，我们需要按值比较核心变化点。
    if (prev.isAuto !== next.isAuto) return false
    if (prev.chunkSize !== next.chunkSize) return false
    if (prev.proxyDisplayLayout !== next.proxyDisplayLayout) return false
    if (prev.group.now !== next.group.now) return false
    if (prev.group.name !== next.group.name) return false
    if (prev.proxies.length !== next.proxies.length) return false
    
    // 如果测速改变了 delay，我们需要依赖组件内部的 delay 更新或者判断 reference
    // 由于 proxy 对象包含 history 且可能频繁变化，我们需要检查每个代理的基础属性和历史记录最后一次延迟
    for (let i = 0; i < prev.proxies.length; i++) {
        const p1 = prev.proxies[i]
        const p2 = next.proxies[i]
        if (p1.name !== p2.name) return false
        
        const d1 = p1.history?.length ? p1.history[p1.history.length - 1].delay : -1
        const d2 = p2.history?.length ? p2.history[p2.history.length - 1].delay : -1
        if (d1 !== d2) return false
    }

    return true
  }
)

ProxyRowChunk.displayName = 'ProxyRowChunk'

const Proxies: React.FC = () => {
  const { controledMihomoConfig } = useControledMihomoConfig()
  const { mode = 'rule' } = controledMihomoConfig || {}
  const { groups: allGroups = [], mutate, isLoading } = useGroups()
  const { appConfig } = useAppConfig()
  const {
    proxyDisplayLayout = 'double',
    proxyDisplayOrder = 'default',
    autoCloseConnection = true,
    proxyCols = 'auto',
    groupOrder = []
  } = appConfig || {}

  // 根据模式过滤显示的组
  const filteredGroups = useMemo(() => {
    if (mode === 'global') {
      return allGroups.filter(group => group.name === 'GLOBAL')
    }
    return allGroups.filter(group => group.name !== 'GLOBAL')
  }, [allGroups, mode])

  // 根据 groupOrder 排序
  const groups = useMemo(() => {
    if (groupOrder.length === 0) return filteredGroups
    const orderMap = new Map(groupOrder.map((name, index) => [name, index]))
    return [...filteredGroups].sort((a, b) => {
      const aIndex = orderMap.get(a.name) ?? Infinity
      const bIndex = orderMap.get(b.name) ?? Infinity
      return aIndex - bIndex
    })
  }, [filteredGroups, groupOrder])

  // Determine a reasonable chunk size based on proxyCols preference
  const chunkSize = useMemo(() => {
    if (proxyCols === 'auto') return 24
    return parseInt(proxyCols) || 3
  }, [proxyCols])

  const [isOpen, setIsOpen] = useState<Record<string, boolean>>({})
  const [delaying, setDelaying] = useState<Record<string, boolean>>({})
  const [searchValue, setSearchValue] = useState<Record<string, string>>({})
  const deferredSearchValue = useDeferredValue(searchValue)
  const [isSettingModalOpen, setIsSettingModalOpen] = useState(false)
  const [isChainModalOpen, setIsChainModalOpen] = useState(false)
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  // 扁平化数据结构
  type FlatItem =
    | { type: 'header'; groupIndex: number }
    | { type: 'proxies'; groupIndex: number; proxies: (ControllerProxiesDetail | ControllerGroupDetail)[] }

  const flatItems = useMemo(() => {
    const items: FlatItem[] = []
    
    groups.forEach((group, index) => {
      // 添加组头
      items.push({ type: 'header', groupIndex: index })
      
      // 如果展开，添加代理行
      const isGroupOpen = !!isOpen[group.name]
      const currentSearchValue = deferredSearchValue[group.name] || ''
      
      if (isGroupOpen) {
        let groupProxies = (group.all || []).filter(
          (proxy) => proxy && includesIgnoreCase(proxy.name, currentSearchValue)
        )

        // 排序逻辑
        if (proxyDisplayOrder === 'delay') {
          groupProxies = groupProxies.sort((a, b) => {
            if (!a.history || a.history.length === 0) return -1
            if (!b.history || b.history.length === 0) return 1
            if (a.history[a.history.length - 1].delay === 0) return 1
            if (b.history[b.history.length - 1].delay === 0) return -1
            return a.history[a.history.length - 1].delay - b.history[b.history.length - 1].delay
          })
        }
        if (proxyDisplayOrder === 'name') {
          groupProxies = groupProxies.sort((a, b) => a.name.localeCompare(b.name))
        }

        // 分组为大的虚拟化行/块
        for (let i = 0; i < groupProxies.length; i += chunkSize) {
          items.push({
            type: 'proxies',
            groupIndex: index,
            proxies: groupProxies.slice(i, i + chunkSize)
          })
        }
      }
    })
    return items
  }, [groups, isOpen, proxyDisplayOrder, chunkSize, deferredSearchValue])



  const onChangeProxy = useCallback(
    async (group: string, proxy: string): Promise<void> => {
      await mihomoChangeProxy(group, proxy)
      if (autoCloseConnection) {
        await mihomoCloseAllConnections(group)
      }
      mutate()
    },
    [autoCloseConnection, mutate]
  )

  const onProxyDelay = useCallback(
    async (proxy: string, url?: string): Promise<ControllerProxiesDelay> => {
      return await mihomoProxyDelay(proxy, url)
    },
    []
  )

  const onGroupDelay = useCallback(
    async (groupName: string, testUrl?: string): Promise<void> => {
      setDelaying((prev) => ({ ...prev, [groupName]: true }))
      
      try {
        await mihomoGroupDelay(groupName, testUrl)
      } catch {
        // ignore
      } finally {
        setDelaying((prev) => ({ ...prev, [groupName]: false }))
        mutate()
      }
    },
    [mutate]
  )

  const toggleOpen = useCallback((groupName: string) => {
    setIsOpen((prev) => ({ ...prev, [groupName]: !prev[groupName] }))
  }, [])

  const updateSearchValue = useCallback((groupName: string, value: string) => {
    setSearchValue((prev) => ({ ...prev, [groupName]: value }))
  }, [])

  // 首次进入页面时自动测速
  const hasInitialTestRef = useRef(false)
  useEffect(() => {
    if (groups.length === 0) return
    if (hasInitialTestRef.current) return
    
    hasInitialTestRef.current = true
    
    const doAutoDelayTest = async (): Promise<void> => {
      const promises = groups.map((group) => {
        if (includesIgnoreCase(group.name, 'proxy') || includesIgnoreCase(group.name, 'compatible')) {
          return Promise.resolve()
        }
        return mihomoGroupDelay(group.name, group.testUrl)
          .then(() => mutate()) // 每个组完成后立即更新 UI
          .catch(() => {})
      })
      
      await Promise.allSettled(promises)
      mutate()
    }
    
    doAutoDelayTest()
  }, [groups, mutate])

  // 获取节点延迟颜色
  const getDelayColor = useCallback((proxy: ControllerProxiesDetail | ControllerGroupDetail): string => {
    if (!proxy.history || proxy.history.length === 0) return 'bg-zinc-400' // 未测试 - 灰色
    const delay = proxy.history[proxy.history.length - 1].delay
    if (delay === 0) return 'bg-zinc-400' // 0 通常表示测试失败或未测试，暂显示为灰色
    const { delayThresholds = { good: 200, fair: 500 } } = appConfig || {}
    if (delay < delayThresholds.good) return 'bg-emerald-500' // 低延迟 - 翠绿色
    if (delay < delayThresholds.fair) return 'bg-amber-400' // 中延迟 - 琥珀色
    return 'bg-red-500' // 高延迟 - 红色
  }, [appConfig])

  // 获取当前节点延迟
  const getCurrentDelay = useCallback((group: ControllerMixedGroup): number => {
    const current = group.all?.find((p) => p.name === group.now)
    if (!current?.history?.length) return -1
    return current.history[current.history.length - 1].delay
  }, [])

  const renderItem = useCallback(
    (_index: number, item: FlatItem) => {
      const { groupIndex } = item

      if (item.type === 'header') {
        const group = groups[groupIndex]
        
        return group ? (
          <ProxyGroupCard
            group={group}
            isOpen={!!isOpen[group.name]}
            toggleOpen={() => toggleOpen(group.name)}
            searchValue={searchValue[group.name] || ''}
            updateSearchValue={(val) => updateSearchValue(group.name, val)}
            delaying={!!delaying[group.name]}
            onGroupDelay={() => onGroupDelay(group.name, group.testUrl)}
            getCurrentDelay={getCurrentDelay}
            mutate={mutate}
            getDelayColor={getDelayColor}
          />
        ) : (
          <div>Never See This</div>
        )
      } else {
        // Render Proxies Row Chunk
        const { proxies } = item
        const isAuto = proxyCols === 'auto'
        return (
          <ProxyRowChunk
            key={`chunk-${groupIndex}-${proxies[0]?.name}`}
            proxies={proxies}
            group={groups[groupIndex]}
            isAuto={isAuto}
            chunkSize={chunkSize}
            mutate={mutate}
            onProxyDelay={onProxyDelay}
            onChangeProxy={onChangeProxy}
            proxyDisplayLayout={proxyDisplayLayout as "hidden" | "single" | "double"}
          />
        )
      }
    },
    [
      groups,
      isOpen,
      searchValue,
      delaying,
      toggleOpen,
      updateSearchValue,
      onGroupDelay,
      mutate,
      getDelayColor,
      getCurrentDelay,
      proxyCols,
      chunkSize,
      proxyDisplayLayout,
      onProxyDelay,
      onChangeProxy,
      appConfig
    ]
  )

  return (
    <BasePage
      title="代理组"
      header={

        <div className="flex items-center gap-1 app-nodrag">
          <Button
            size="sm"
            isIconOnly
            variant="light"
            title="管理代理链"
            onPress={() => setIsChainModalOpen(true)}
          >
            <MdLink className="text-lg" />
          </Button>
          <Button
            size="sm"
            isIconOnly
            variant="light"
            title="代理组设置"
            onPress={() => setIsSettingModalOpen(true)}
          >
            <MdTune className="text-lg" />
          </Button>
        </div>
      }
    >
      {isSettingModalOpen && <ProxySettingModal onClose={() => setIsSettingModalOpen(false)} />}
      {isChainModalOpen && <ProxyChainModal onClose={() => setIsChainModalOpen(false)} />}
      {mode === 'direct' ? (
        <EmptyState
          icon={<TbBolt className="!text-[40px] text-teal-500" />}
          title="直连模式"
          description="所有流量将直接连接，不经过代理"
        />
      ) : isLoading && (!allGroups || allGroups.length === 0) ? (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProxyCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : (
        <div className="h-[calc(100vh-50px)]">
          <Virtuoso
            ref={virtuosoRef}
            data={flatItems}
            itemContent={renderItem}
          />
        </div>
      )}
    </BasePage>
  )
}

export default Proxies
