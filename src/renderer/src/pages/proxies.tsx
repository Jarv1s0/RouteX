import { Button, Card, CardBody } from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import {
  mihomoChangeProxy,
  mihomoCloseAllConnections,
  mihomoProxyDelay,
  mihomoGroupDelay
} from '@renderer/utils/ipc'
import { useEffect, useMemo, useRef, useState, useCallback, useDeferredValue } from 'react'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import ProxyItem from '@renderer/components/proxies/proxy-item'
import ProxySettingModal from '@renderer/components/proxies/proxy-setting-modal'
import { MdTune } from 'react-icons/md'
import { TbBolt } from 'react-icons/tb'
import { useGroups } from '@renderer/hooks/use-groups'
import { includesIgnoreCase } from '@renderer/utils/includes'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { ProxyGroupCard } from '@renderer/components/proxies/proxy-group-card'
import { ProxyCardSkeleton } from '@renderer/components/base/skeleton'

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
    delayTestConcurrency = 50,
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
  const [cols, setCols] = useState(1)
  const [isOpen, setIsOpen] = useState(Array(groups.length).fill(false))
  const [delaying, setDelaying] = useState(Array(groups.length).fill(false))
  const [searchValue, setSearchValue] = useState(Array(groups.length).fill(''))
  const deferredSearchValue = useDeferredValue(searchValue)
  const [isSettingModalOpen, setIsSettingModalOpen] = useState(false)
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
      const isGroupOpen = !!isOpen[index]
      const currentSearchValue = deferredSearchValue[index] || ''
      
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

        // 分组为行
        for (let i = 0; i < groupProxies.length; i += cols) {
          items.push({
            type: 'proxies',
            groupIndex: index,
            proxies: groupProxies.slice(i, i + cols)
          })
        }
      }
    })
    return items
  }, [groups, isOpen, proxyDisplayOrder, cols, deferredSearchValue])

  // 同步状态数组长度
  useEffect(() => {
    if (groups.length !== searchValue.length) {
      setSearchValue(prev => {
        if (prev.length === groups.length) return prev
        // 尝试保留旧状态（如果只是追加或减少）
        if (groups.length > prev.length) {
             return [...prev, ...Array(groups.length - prev.length).fill('')]
        }
        return prev.slice(0, groups.length)
      })
    }
    if (groups.length !== isOpen.length) {
        setIsOpen(prev => {
            if (prev.length === groups.length) return prev
            if (groups.length > prev.length) {
                return [...prev, ...Array(groups.length - prev.length).fill(false)]
            }
            return prev.slice(0, groups.length)
        })
    }
    if (groups.length !== delaying.length) {
        setDelaying(prev => {
             if (prev.length === groups.length) return prev
             if (groups.length > prev.length) {
                return [...prev, ...Array(groups.length - prev.length).fill(false)]
            }
            return prev.slice(0, groups.length)
        })
    }
  }, [groups.length])

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
    async (index: number): Promise<void> => {
      setDelaying((prev) => {
        const newDelaying = [...prev]
        newDelaying[index] = true
        return newDelaying
      })
      
      const group = groups[index]
      const currentSearch = searchValue[index]

      try {
        // 如果没有搜索关键字，或者搜索关键字为空，直接使用内核组测速（效率更高且稳定）
        if (!currentSearch || currentSearch.trim() === '') {
           await mihomoGroupDelay(group.name, group.testUrl)
           // 延迟一下再刷新，确保内核状态更新
           setTimeout(() => mutate(), 500)
        } else {
          // 有搜索筛选时，只测筛选出的节点
          const groupProxies = group.all.filter(
             (proxy) => proxy && includesIgnoreCase(proxy.name, currentSearch)
          )
          
          const result: Promise<void>[] = []
          const runningList: Promise<void>[] = []
          
          for (const proxy of groupProxies) {
            const promise = Promise.resolve().then(async () => {
              try {
                await mihomoProxyDelay(proxy.name, group.testUrl)
              } catch {
                // ignore
              } finally {
                mutate()
              }
            })
            result.push(promise)
            const running = promise.then(() => {
              runningList.splice(runningList.indexOf(running), 1)
            })
            runningList.push(running)
            if (runningList.length >= (delayTestConcurrency || 50)) {
              await Promise.race(runningList)
            }
          }
          await Promise.all(result)
        }
      } catch (e) {
        console.error('Group delay test failed', e)
      } finally {
        setDelaying((prev) => {
          const newDelaying = [...prev]
          newDelaying[index] = false
          return newDelaying
        })
        mutate() // Final refresh
      }
    },
    [groups, delayTestConcurrency, mutate, searchValue]
  )

  const calcCols = useCallback((): number => {
    if (window.matchMedia('(min-width: 1536px)').matches) {
      return 5
    } else if (window.matchMedia('(min-width: 1280px)').matches) {
      return 4
    } else if (window.matchMedia('(min-width: 1024px)').matches) {
      return 3
    } else {
      return 2
    }
  }, [])

  const toggleOpen = useCallback((index: number) => {
    setIsOpen((prev) => {
      const newOpen = [...prev]
      const wasOpen = prev[index]
      newOpen[index] = !wasOpen
      return newOpen
    })
  }, [])

  const updateSearchValue = useCallback((index: number, value: string) => {
    setSearchValue((prev) => {
      const newSearchValue = [...prev]
      newSearchValue[index] = value
      return newSearchValue
    })
  }, [])

  useEffect(() => {
    if (proxyCols !== 'auto') {
      setCols(parseInt(proxyCols))
      return
    }
    setCols(calcCols())
    const handleResize = (): void => {
      setCols(calcCols())
    }
    window.addEventListener('resize', handleResize)
    return (): void => {
      window.removeEventListener('resize', handleResize)
    }
  }, [proxyCols, calcCols])

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
            groupIndex={groupIndex}
            isOpen={!!isOpen[groupIndex]}
            toggleOpen={toggleOpen}
            searchValue={searchValue[groupIndex] || ''}
            updateSearchValue={updateSearchValue}
            delaying={!!delaying[groupIndex]}
            onGroupDelay={onGroupDelay}
            getCurrentDelay={getCurrentDelay}
            mutate={mutate}
            getDelayColor={getDelayColor}
          />
        ) : (
          <div>Never See This</div>
        )
      } else {
        // Render Proxies Row
        const { proxies } = item
        return (
          <div
            style={
              proxyCols !== 'auto'
                ? { gridTemplateColumns: `repeat(${proxyCols}, minmax(0, 1fr))` }
                : {}
            }
            className={`w-full grid ${proxyCols === 'auto' ? 'sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5' : ''} gap-2 px-2 pt-2`}
          >
            {Array.from({ length: cols }).map((_, i) => {
              if (!proxies[i]) return null
              return (
                <ProxyItem
                  key={proxies[i].name}
                  mutateProxies={mutate}
                  onProxyDelay={onProxyDelay}
                  onSelect={onChangeProxy}
                  proxy={proxies[i]}
                  group={groups[groupIndex]}
                  proxyDisplayLayout={proxyDisplayLayout}
                  selected={
                    proxies[i]?.name === groups[groupIndex].now
                  }
                  index={i} // simple index, real tracking might need more if needed
                />
              )
            })}
          </div>
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
      cols,
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
        <Button
          size="sm"
          isIconOnly
          variant="light"
          className="app-nodrag"
          title="代理组设置"
          onPress={() => setIsSettingModalOpen(true)}
        >
          <MdTune className="text-lg" />
        </Button>
      }
    >
      {isSettingModalOpen && <ProxySettingModal onClose={() => setIsSettingModalOpen(false)} />}
      {mode === 'direct' ? (
        <div className="h-full w-full flex justify-center items-center p-4">
          <Card className="bg-default-100/50 border-none shadow-sm px-12 py-8">
            <CardBody className="flex flex-col items-center gap-2">
              <div className="w-20 h-20 rounded-full bg-teal-500/20 flex items-center justify-center">
                <TbBolt className="text-teal-500 text-[48px]" />
              </div>
              <h2 className="text-foreground text-xl font-semibold mt-2">直连模式</h2>
              <p className="text-foreground-500 text-sm">所有流量将直接连接，不经过代理</p>
            </CardBody>
          </Card>
        </div>
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
