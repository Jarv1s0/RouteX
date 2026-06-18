import { Button } from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import EmptyState from '@renderer/components/base/empty-state'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { memo, useCallback, useRef, useState } from 'react'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import ProxyItem from '@renderer/components/proxies/proxy-item'
import ProxySettingModal from '@renderer/components/proxies/proxy-setting-modal'
import { MdTune, MdLink } from 'react-icons/md'
import { TbBolt } from 'react-icons/tb'
import { useGroups } from '@renderer/hooks/use-groups'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { ProxyGroupCard } from '@renderer/components/proxies/proxy-group-card'
import { ProxyCardSkeleton } from '@renderer/components/base/skeleton'
import { useI18n } from '@renderer/i18n'
import { FlatItem, useProxyListModel } from '@renderer/hooks/use-proxy-list-model'
import { useProxyDelayRunner } from '@renderer/hooks/use-proxy-delay-runner'
import { useProxyAutoDelay } from '@renderer/hooks/use-proxy-auto-delay'

// ----------------------------------------
// ProxyRowChunk: 独立的 Grid 块渲染组件，用于性能优化
// ----------------------------------------
interface ProxyRowChunkProps {
  proxies: (ControllerProxiesDetail | ControllerGroupDetail)[]
  group: ControllerMixedGroup
  isAuto: boolean
  chunkSize: number
  delayVersion: string
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
    delayVersion,
    mutate,
    onProxyDelay,
    onChangeProxy,
    proxyDisplayLayout
  }: ProxyRowChunkProps) => {
    return (
      <div
        style={!isAuto ? { gridTemplateColumns: `repeat(${chunkSize}, minmax(0, 1fr))` } : {}}
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
              delayVersion={delayVersion}
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
    if (prev.isAuto !== next.isAuto) return false
    if (prev.chunkSize !== next.chunkSize) return false
    if (prev.delayVersion !== next.delayVersion) return false
    if (prev.proxyDisplayLayout !== next.proxyDisplayLayout) return false
    if (prev.group.now !== next.group.now) return false
    if (prev.group.name !== next.group.name) return false
    if (prev.proxies.length !== next.proxies.length) return false

    for (let i = 0; i < prev.proxies.length; i++) {
      const p1 = prev.proxies[i]
      const p2 = next.proxies[i]
      if (p1.name !== p2.name) return false
      if (p1.type !== p2.type) return false

      const d1 = p1.history?.length ? p1.history[p1.history.length - 1].delay : -1
      const d2 = p2.history?.length ? p2.history[p2.history.length - 1].delay : -1
      if (d1 !== d2) return false

      const p1Now = 'now' in p1 ? p1.now : undefined
      const p2Now = 'now' in p2 ? p2.now : undefined
      if (p1Now !== p2Now) return false

      const p1ChildrenCount = 'all' in p1 && Array.isArray(p1.all) ? p1.all.length : -1
      const p2ChildrenCount = 'all' in p2 && Array.isArray(p2.all) ? p2.all.length : -1
      if (p1ChildrenCount !== p2ChildrenCount) return false
    }

    return true
  }
)

ProxyRowChunk.displayName = 'ProxyRowChunk'

const Proxies: React.FC = () => {
  const { t } = useI18n()
  const { controledMihomoConfig } = useControledMihomoConfig()
  const { mode = 'rule' } = controledMihomoConfig || {}
  const { groups: allGroups = [], mutate, isLoading } = useGroups()
  const { appConfig } = useAppConfig()
  const {
    proxyDisplayLayout = 'double',
    proxyDisplayOrder = 'default',
    autoCloseConnection = true,
    proxyCols = 'auto',
    groupOrder = [],
    autoDelayTestOnShow = true,
    delayTestConcurrency = 4
  } = appConfig || {}

  const [isOpen, setIsOpen] = useState<Record<string, boolean>>({})
  const [isSettingModalOpen, setIsSettingModalOpen] = useState(false)
  const virtuosoRef = useRef<VirtuosoHandle>(null)

  const {
    renderGroups,
    delayVersion,
    proxyGroupMetrics,
    autoDelayGroupSignature,
    chunkSize,
    flatItems
  } = useProxyListModel({
    mode,
    allGroups,
    groupOrder,
    proxyDisplayOrder,
    proxyCols,
    isOpen
  })

  const {
    delaying,
    setGroupsDelaying,
    runDelayTargets,
    onChangeProxy,
    onProxyDelay,
    onGroupDelay,
    delayOpenedGroup
  } = useProxyDelayRunner({
    mutate,
    autoCloseConnection,
    delayTestConcurrency
  })

  const groupsRef = useRef(renderGroups)
  groupsRef.current = renderGroups
  const delayTestConcurrencyRef = useRef(delayTestConcurrency)
  delayTestConcurrencyRef.current = delayTestConcurrency

  useProxyAutoDelay({
    groupsRef,
    autoDelayGroupSignature,
    autoDelayTestOnShow,
    delayTestConcurrencyRef,
    runDelayTargets,
    setGroupsDelaying
  })

  const toggleOpen = useCallback(
    (groupName: string) => {
      setIsOpen((prev) => {
        const nextOpen = !prev[groupName]
        if (nextOpen && autoDelayTestOnShow) {
          const group = groupsRef.current.find(g => g.name === groupName)
          void delayOpenedGroup(group)
        }
        return { ...prev, [groupName]: nextOpen }
      })
    },
    [autoDelayTestOnShow, delayOpenedGroup]
  )

  const renderItem = useCallback(
    (_index: number, item: FlatItem) => {
      const { groupIndex } = item

      if (item.type === 'header') {
        const group = renderGroups[groupIndex]
        const metrics = group
          ? proxyGroupMetrics.get(group.name) || { currentDelay: -1, liveCount: 0 }
          : undefined

        return group ? (
          <ProxyGroupCard
            group={group}
            isOpen={!!isOpen[group.name]}
            toggleOpen={() => toggleOpen(group.name)}
            delaying={!!delaying[group.name]}
            delayVersion={delayVersion}
            currentDelay={metrics?.currentDelay ?? -1}
            liveCount={metrics?.liveCount ?? 0}
            onGroupDelay={() => onGroupDelay(group)}
            mutate={mutate}
          />
        ) : (
          <div>Never See This</div>
        )
      } else {
        const { proxies } = item
        const isAuto = proxyCols === 'auto'
        return (
          <ProxyRowChunk
            key={`chunk-${groupIndex}-${proxies[0]?.name}`}
            proxies={proxies}
            group={renderGroups[groupIndex]}
            isAuto={isAuto}
            chunkSize={chunkSize}
            delayVersion={delayVersion}
            mutate={mutate}
            onProxyDelay={onProxyDelay}
            onChangeProxy={onChangeProxy}
            proxyDisplayLayout={proxyDisplayLayout as 'hidden' | 'single' | 'double'}
          />
        )
      }
    },
    [
      renderGroups,
      proxyGroupMetrics,
      isOpen,
      delaying,
      toggleOpen,
      onGroupDelay,
      mutate,
      delayVersion,
      proxyCols,
      chunkSize,
      proxyDisplayLayout,
      onProxyDelay,
      onChangeProxy
    ]
  )

  return (
    <BasePage
      title={
        <div className="flex items-center gap-2">
          <span>{t('page.proxies.title')}</span>
          <Button
            size="sm"
            isIconOnly
            variant="light"
            className="h-6 w-6 min-w-0 app-nodrag text-default-500"
            title={t('page.proxies.settings')}
            onPress={() => setIsSettingModalOpen(true)}
          >
            <MdTune className="text-base" />
          </Button>
        </div>
      }
    >
      {isSettingModalOpen && <ProxySettingModal onClose={() => setIsSettingModalOpen(false)} />}
      {mode === 'direct' ? (
        <EmptyState
          icon={<TbBolt className="!text-[40px] text-teal-500" />}
          title={t('page.proxies.directMode')}
          description={t('page.proxies.directModeDescription')}
        />
      ) : isLoading && (!allGroups || allGroups.length === 0) ? (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProxyCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : renderGroups.length === 0 ? (
        <EmptyState
          icon={<MdLink className="!text-[40px] text-default-400" />}
          title={t('page.proxies.emptyTitle')}
          description={t('page.proxies.emptyDescription')}
        />
      ) : (
        <div className="h-[calc(100vh-50px)]">
          <Virtuoso ref={virtuosoRef} data={flatItems} itemContent={renderItem} />
        </div>
      )}
    </BasePage>
  )
}

export default Proxies
