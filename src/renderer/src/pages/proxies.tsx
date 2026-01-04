import { Button, Card, CardBody } from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import {
  getImageDataURL,
  mihomoChangeProxy,
  mihomoCloseAllConnections,
  mihomoProxyDelay,
  mihomoGroupDelay
} from '@renderer/utils/ipc'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { GroupedVirtuoso, GroupedVirtuosoHandle } from 'react-virtuoso'
import ProxyItem from '@renderer/components/proxies/proxy-item'
import ProxySettingModal from '@renderer/components/proxies/proxy-setting-modal'
import { MdOutlineSpeed, MdTune } from 'react-icons/md'
import { TbBolt } from 'react-icons/tb'
import { useGroups } from '@renderer/hooks/use-groups'
import CollapseInput from '@renderer/components/base/collapse-input'
import { includesIgnoreCase } from '@renderer/utils/includes'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'

const Proxies: React.FC = () => {
  const { controledMihomoConfig } = useControledMihomoConfig()
  const { mode = 'rule' } = controledMihomoConfig || {}
  const { groups: allGroups = [], mutate } = useGroups()
  const { appConfig } = useAppConfig()
  const {
    proxyDisplayLayout = 'double',
    proxyDisplayOrder = 'default',
    autoCloseConnection = true,
    proxyCols = 'auto',
    delayTestConcurrency = 50,
    groupOrder = [],
    autoDelayTestOnShow = false
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
  const [isSettingModalOpen, setIsSettingModalOpen] = useState(false)
  const virtuosoRef = useRef<GroupedVirtuosoHandle>(null)
  const { groupCounts, allProxies } = useMemo(() => {
    const groupCounts: number[] = []
    const allProxies: (ControllerProxiesDetail | ControllerGroupDetail)[][] = []
    if (groups.length !== searchValue.length) setSearchValue(Array(groups.length).fill(''))
    groups.forEach((group, index) => {
      if (isOpen[index]) {
        let groupProxies = group.all.filter(
          (proxy) => proxy && includesIgnoreCase(proxy.name, searchValue[index])
        )
        const count = Math.floor(groupProxies.length / cols)
        groupCounts.push(groupProxies.length % cols === 0 ? count : count + 1)
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
        allProxies.push(groupProxies)
      } else {
        groupCounts.push(0)
        allProxies.push([])
      }
    })
    return { groupCounts, allProxies }
  }, [groups, isOpen, proxyDisplayOrder, cols, searchValue])

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
      if (allProxies[index].length === 0) {
        setIsOpen((prev) => {
          const newOpen = [...prev]
          newOpen[index] = true
          return newOpen
        })
      }
      setDelaying((prev) => {
        const newDelaying = [...prev]
        newDelaying[index] = true
        return newDelaying
      })
      const result: Promise<void>[] = []
      const runningList: Promise<void>[] = []
      for (const proxy of allProxies[index]) {
        const promise = Promise.resolve().then(async () => {
          try {
            await mihomoProxyDelay(proxy.name, groups[index].testUrl)
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
      setDelaying((prev) => {
        const newDelaying = [...prev]
        newDelaying[index] = false
        return newDelaying
      })
    },
    [allProxies, groups, delayTestConcurrency, mutate]
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
      // 如果是展开操作，自动触发测速
      if (!wasOpen) {
        setTimeout(() => onGroupDelay(index), 100)
      }
      return newOpen
    })
  }, [onGroupDelay])

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
    if (!autoDelayTestOnShow) return
    if (groups.length === 0) return
    if (hasInitialTestRef.current) return
    
    hasInitialTestRef.current = true
    
    const doAutoDelayTest = async (): Promise<void> => {
      for (const group of groups) {
        try {
          await mihomoGroupDelay(group.name, group.testUrl)
        } catch {
          // ignore
        }
      }
      mutate()
    }
    
    doAutoDelayTest()
  }, [autoDelayTestOnShow, groups, mutate])

  // 获取节点延迟颜色
  const getDelayColor = useCallback((proxy: ControllerProxiesDetail | ControllerGroupDetail): string => {
    if (!proxy.history || proxy.history.length === 0) return 'bg-zinc-400' // 未测试 - 灰色
    const delay = proxy.history[proxy.history.length - 1].delay
    if (delay === 0) return 'bg-red-500' // 超时 - 红色
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

  const groupContent = useCallback(
    (index: number) => {
      if (
        groups[index] &&
        groups[index].icon &&
        groups[index].icon.startsWith('http') &&
        !localStorage.getItem(groups[index].icon)
      ) {
        getImageDataURL(groups[index].icon).then((dataURL) => {
          localStorage.setItem(groups[index].icon, dataURL)
          mutate()
        })
      }
      
      const group = groups[index]
      const currentDelay = getCurrentDelay(group)
      const { delayThresholds = { good: 200, fair: 500 } } = appConfig || {}
      const delayColor = currentDelay === -1 ? 'text-default-400' : currentDelay === 0 ? 'text-danger' : currentDelay < delayThresholds.good ? 'text-success' : currentDelay < delayThresholds.fair ? 'text-warning' : 'text-danger'
      
      return group ? (
        <div
          className={`w-full pt-2 ${index === groupCounts.length - 1 && !isOpen[index] ? 'pb-2' : ''} px-2`}
        >
          <Card
            as="div"
            isPressable
            fullWidth
            onPress={() => toggleOpen(index)}
            className={`transition-all duration-200 ${isOpen[index] ? 'shadow-md bg-content3' : 'hover:shadow-md'}`}
          >
            <CardBody className="w-full p-3">
              {/* 第一行：组名、类型、节点数、延迟 */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {group.icon && (
                    <img
                      className="w-5 h-5 object-contain"
                      src={
                        group.icon.startsWith('<svg')
                          ? `data:image/svg+xml;utf8,${group.icon}`
                          : localStorage.getItem(group.icon) || group.icon
                      }
                      alt=""
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  )}
                  <span className="font-medium">{group.name}</span>
                  <span className="text-xs text-foreground-400">: {group.type}</span>
                  <span className="text-xs text-foreground-400">({group.all.filter(p => {
                    if (!p.history || p.history.length === 0) return false
                    return p.history[p.history.length - 1].delay > 0
                  }).length}/{group.all.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${delayColor}`}>
                    {currentDelay === -1 ? '--' : currentDelay === 0 ? '超时' : currentDelay}
                  </span>
                  {isOpen[index] && (
                    <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                      <CollapseInput
                        title="搜索节点"
                        value={searchValue[index]}
                        onValueChange={(v) => updateSearchValue(index, v)}
                      />
                      <Button
                        title="延迟测试"
                        variant="light"
                        isLoading={delaying[index]}
                        size="sm"
                        isIconOnly
                        onPress={() => onGroupDelay(index)}
                      >
                        <MdOutlineSpeed className="text-lg text-foreground-500" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              
              {/* 第二行：当前节点 */}
              <div className="flex justify-between items-center mt-1">
                <div className="flex items-center gap-1 text-sm text-foreground-500">
                  <span className="flag-emoji">{group.now}</span>
                </div>
              </div>
              
              {/* 第三行：节点状态圆点（收起时显示） */}
              {!isOpen[index] && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {group.all.slice(0, 20).map((proxy, i) => (
                    <div
                      key={i}
                      className={`w-3 h-3 rounded-full ${getDelayColor(proxy)} ${proxy.name === group.now ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                      title={`${proxy.name}: ${proxy.history?.length ? (proxy.history[proxy.history.length - 1].delay || '超时') + 'ms' : '未测试'}`}
                    />
                  ))}
                  {group.all.length > 20 && (
                    <span className="text-xs text-foreground-400 ml-1">+{group.all.length - 20}</span>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      ) : (
        <div>Never See This</div>
      )
    },
    [
      groups,
      groupCounts,
      isOpen,
      searchValue,
      delaying,
      toggleOpen,
      updateSearchValue,
      onGroupDelay,
      mutate,
      getDelayColor,
      getCurrentDelay
    ]
  )

  const itemContent = useCallback(
    (index: number, groupIndex: number) => {
      let innerIndex = index
      groupCounts.slice(0, groupIndex).forEach((count) => {
        innerIndex -= count
      })
      return allProxies[groupIndex] ? (
        <div
          style={
            proxyCols !== 'auto'
              ? { gridTemplateColumns: `repeat(${proxyCols}, minmax(0, 1fr))` }
              : {}
          }
          className={`grid ${proxyCols === 'auto' ? 'sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5' : ''} ${groupIndex === groupCounts.length - 1 && innerIndex === groupCounts[groupIndex] - 1 ? 'pb-2' : ''} gap-2 pt-2 mx-2`}
        >
          {Array.from({ length: cols }).map((_, i) => {
            if (!allProxies[groupIndex][innerIndex * cols + i]) return null
            return (
              <ProxyItem
                key={allProxies[groupIndex][innerIndex * cols + i].name}
                mutateProxies={mutate}
                onProxyDelay={onProxyDelay}
                onSelect={onChangeProxy}
                proxy={allProxies[groupIndex][innerIndex * cols + i]}
                group={groups[groupIndex]}
                proxyDisplayLayout={proxyDisplayLayout}
                selected={
                  allProxies[groupIndex][innerIndex * cols + i]?.name === groups[groupIndex].now
                }
                index={innerIndex * cols + i}
              />
            )
          })}
        </div>
      ) : (
        <div>Never See This</div>
      )
    },
    [
      groupCounts,
      allProxies,
      proxyCols,
      cols,
      mutate,
      onProxyDelay,
      onChangeProxy,
      groups,
      proxyDisplayLayout
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
          <Card className="px-12 py-8">
            <CardBody className="flex flex-col items-center gap-2">
              <div className="w-20 h-20 rounded-full bg-teal-500/20 flex items-center justify-center">
                <TbBolt className="text-teal-500 text-[48px]" />
              </div>
              <h2 className="text-foreground text-xl font-semibold mt-2">直连模式</h2>
              <p className="text-foreground-500 text-sm">所有流量将直接连接，不经过代理</p>
            </CardBody>
          </Card>
        </div>
      ) : (
        <div className="h-[calc(100vh-50px)]">
          <GroupedVirtuoso
            ref={virtuosoRef}
            groupCounts={groupCounts}
            groupContent={groupContent}
            itemContent={itemContent}
          />
        </div>
      )}
    </BasePage>
  )
}

export default Proxies
