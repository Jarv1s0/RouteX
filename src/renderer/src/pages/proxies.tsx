import { Button, Input } from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import EmptyState from '@renderer/components/base/empty-state'
import SecondaryModalCloseButton from '@renderer/components/base/secondary-modal-close'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import ProxyItem from '@renderer/components/proxies/proxy-item'
import ProxySettingModal from '@renderer/components/proxies/proxy-setting-modal'
import { MdTune, MdLink, MdOutlineSpeed } from 'react-icons/md'
import { IoSearchOutline } from 'react-icons/io5'
import { TbBolt } from 'react-icons/tb'
import { useGroups } from '@renderer/hooks/use-groups'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import {
  GroupIconBadge,
  ProxyGroupCard,
  getGroupStatusDotClass
} from '@renderer/components/proxies/proxy-group-card'
import { ProxyCardSkeleton } from '@renderer/components/base/skeleton'
import { useI18n } from '@renderer/i18n'
import { ProxyNodeItem, useProxyListModel } from '@renderer/hooks/use-proxy-list-model'
import { useProxyDelayRunner } from '@renderer/hooks/use-proxy-delay-runner'
import { useProxyAutoDelay } from '@renderer/hooks/use-proxy-auto-delay'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { addFlag } from '@renderer/utils/flags'

const PUSH_DRAWER_BREAKPOINT = 720
const DRAWER_SEARCH_INPUT_CLASSNAMES = {
  ...CARD_STYLES.GLASS_INPUT,
  inputWrapper: `${CARD_STYLES.GLASS_INPUT.inputWrapper} !outline-none focus-within:!outline-none focus-within:!ring-0`,
  input: `${CARD_STYLES.GLASS_INPUT.input} !outline-none focus:!outline-none`
}

interface ProxyRowChunkProps {
  proxies: ProxyNodeItem[]
  group: ControllerMixedGroup
  isAuto: boolean
  inDrawer?: boolean
  chunkSize: number
  delayVersion: string
  mutate: () => void
  onProxyDelay: (proxy: string, url?: string) => Promise<void>
  onChangeProxy: (group: string, proxy: string) => Promise<void>
  proxyDisplayLayout: 'hidden' | 'single' | 'double'
}

const ProxyRowChunk = memo(
  ({
    proxies,
    group,
    isAuto,
    inDrawer = false,
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
            ? inDrawer
              ? 'grid-cols-[repeat(auto-fill,minmax(175px,1fr))]'
              : 'grid-cols-[repeat(auto-fill,minmax(190px,1fr))]'
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
    if (prev.inDrawer !== next.inDrawer) return false
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

const VirtuosoFooter: React.FC = () => <div className="h-3" />
const VIRTUOSO_COMPONENTS = { Footer: VirtuosoFooter }

interface GroupDetailSummaryProps {
  group: ControllerMixedGroup
  liveCount: number
  statusDotClass: string
}

const GroupDetailSummary: React.FC<GroupDetailSummaryProps> = ({
  group,
  liveCount,
  statusDotClass
}) => (
  <div className="flex items-center gap-2.5 min-w-0 flex-1">
    <GroupIconBadge icon={group.icon} active size="lg" />
    <div className="flex flex-col min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="truncate font-bold text-[15px] leading-tight text-foreground"
          title={group.name}
        >
          {group.name}
        </span>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-default-400">
          {group.type}
        </span>
      </div>
      <div className="mt-0.5 flex items-center gap-2 min-w-0 text-xs text-default-500">
        <span className="flex items-center gap-1.5 shrink-0 font-mono tabular-nums">
          <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass}`} />
          {liveCount}
          <span className="opacity-45">/</span>
          {(group.all || []).length}
        </span>
        {group.now && (
          <>
            <span className="text-default-300 dark:text-white/15">·</span>
            <span className="flag-emoji min-w-0 truncate text-foreground/80" title={group.now}>
              {addFlag(group.now)}
            </span>
          </>
        )}
      </div>
    </div>
  </div>
)

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

  const [activeGroupName, setActiveGroupName] = useState<string | null>(null)
  const [closingGroup, setClosingGroup] = useState<ControllerMixedGroup | null>(null)
  const [drawerEntered, setDrawerEntered] = useState(false)
  const [canPushDrawer, setCanPushDrawer] = useState(true)
  const [showDrawerSearch, setShowDrawerSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSettingModalOpen, setIsSettingModalOpen] = useState(false)
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const splitContainerRef = useRef<HTMLDivElement>(null)
  const drawerSearchInputRef = useRef<HTMLInputElement>(null)

  const {
    renderGroups,
    activeGroup,
    detailGroup,
    delayVersion,
    proxyGroupMetrics,
    autoDelayGroupSignature,
    chunkSize,
    proxyChunks
  } = useProxyListModel({
    mode,
    allGroups,
    groupOrder,
    proxyDisplayOrder,
    proxyCols,
    activeGroupName,
    searchQuery
  })

  const {
    delaying,
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
    runDelayTargets
  })

  const isSingleGroupMode = renderGroups.length === 1
  const drawerGroup = isSingleGroupMode ? null : (activeGroup ?? closingGroup)
  const isDrawerOpen = Boolean(!isSingleGroupMode && activeGroup)

  useEffect(() => {
    const el = splitContainerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const updateWidth = (width: number): void => {
      if (width <= 0) return
      setCanPushDrawer(width >= PUSH_DRAWER_BREAKPOINT)
    }

    updateWidth(el.clientWidth)
    const observer = new ResizeObserver((entries) => {
      updateWidth(entries[0]?.contentRect.width ?? el.clientWidth)
    })
    observer.observe(el)

    return () => observer.disconnect()
  }, [mode, isLoading, renderGroups.length])

  useEffect(() => {
    if (isSingleGroupMode || !activeGroup) {
      setDrawerEntered(false)
      const timer = window.setTimeout(() => setClosingGroup(null), 200)
      return () => window.clearTimeout(timer)
    }

    setClosingGroup(activeGroup)
    const frameId = window.requestAnimationFrame(() => {
      setDrawerEntered(true)
    })
    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [activeGroup, isSingleGroupMode])

  useEffect(() => {
    if (activeGroupName && !activeGroup && !isSingleGroupMode) {
      setActiveGroupName(null)
    }
  }, [activeGroupName, activeGroup, isSingleGroupMode])

  const closeDrawer = useCallback(() => {
    setActiveGroupName(null)
    setShowDrawerSearch(false)
    setSearchQuery('')
  }, [])

  const handleGridBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!isDrawerOpen) return
      const target = event.target as HTMLElement | null
      if (target?.closest('[data-proxy-group-card="true"]')) {
        return
      }
      closeDrawer()
    },
    [isDrawerOpen, closeDrawer]
  )

  useEffect(() => {
    if (!showDrawerSearch || !isDrawerOpen) return
    const frameId = window.requestAnimationFrame(() => {
      drawerSearchInputRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [showDrawerSearch, isDrawerOpen])

  useEffect(() => {
    if (!isDrawerOpen) return
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        if (showDrawerSearch || searchQuery) {
          setSearchQuery('')
          setShowDrawerSearch(false)
          return
        }
        closeDrawer()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDrawerOpen, showDrawerSearch, searchQuery, closeDrawer])

  const handleOpenGroup = useCallback(
    (groupName: string) => {
      setActiveGroupName((prev) => {
        if (prev === groupName) {
          setShowDrawerSearch(false)
          setSearchQuery('')
          return null
        }
        setShowDrawerSearch(false)
        setSearchQuery('')
        virtuosoRef.current?.scrollTo({ top: 0 })
        if (autoDelayTestOnShow) {
          const group = groupsRef.current.find((item) => item.name === groupName)
          void delayOpenedGroup(group)
        }
        return groupName
      })
    },
    [autoDelayTestOnShow, delayOpenedGroup]
  )

  const effectiveChunkSize =
    !isSingleGroupMode && proxyCols !== 'auto' ? Math.min(chunkSize, 2) : chunkSize
  const effectiveIsAuto = proxyCols === 'auto'

  const renderChunk = useCallback(
    (_index: number, proxies: ProxyNodeItem[]) => {
      if (!detailGroup) return null
      return (
        <ProxyRowChunk
          key={`chunk-${detailGroup.name}-${proxies[0]?.name}`}
          proxies={proxies}
          group={detailGroup}
          isAuto={effectiveIsAuto}
          inDrawer={!isSingleGroupMode}
          chunkSize={effectiveChunkSize}
          delayVersion={delayVersion}
          mutate={mutate}
          onProxyDelay={onProxyDelay}
          onChangeProxy={onChangeProxy}
          proxyDisplayLayout={proxyDisplayLayout as 'hidden' | 'single' | 'double'}
        />
      )
    },
    [
      detailGroup,
      isSingleGroupMode,
      effectiveIsAuto,
      effectiveChunkSize,
      delayVersion,
      mutate,
      onProxyDelay,
      onChangeProxy,
      proxyDisplayLayout
    ]
  )

  const drawerMetrics = drawerGroup
    ? proxyGroupMetrics.get(drawerGroup.name) || { currentDelay: -1, liveCount: 0 }
    : { currentDelay: -1, liveCount: 0 }
  const drawerStatusDotClass = getGroupStatusDotClass(
    drawerMetrics.liveCount,
    (drawerGroup?.all || []).length
  )

  const singleGroup = isSingleGroupMode ? renderGroups[0] : null
  const singleMetrics = singleGroup
    ? proxyGroupMetrics.get(singleGroup.name) || { currentDelay: -1, liveCount: 0 }
    : { currentDelay: -1, liveCount: 0 }
  const singleStatusDotClass = getGroupStatusDotClass(
    singleMetrics.liveCount,
    (singleGroup?.all || []).length
  )

  return (
    <BasePage
      title={
        <div className="flex items-center gap-1.5">
          <span className="mr-0.5">{t('page.proxies.title')}</span>
          <Button
            size="sm"
            isIconOnly
            variant="light"
            className="h-7 w-7 min-w-7 rounded-lg app-nodrag text-default-500 hover:text-foreground"
            title={t('page.proxies.settings')}
            aria-label={t('page.proxies.settings')}
            onPress={() => setIsSettingModalOpen(true)}
          >
            <MdTune className="text-[17px]" />
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
      ) : isSingleGroupMode && singleGroup ? (
        <div className="h-[calc(100vh-49px)] flex flex-col overflow-hidden">
          <div className="shrink-0 px-2 pt-2">
            <div
              className={`w-full flex flex-wrap items-center justify-between gap-2 ${CARD_STYLES.GLASS_TOOLBAR}`}
            >
              <GroupDetailSummary
                group={singleGroup}
                liveCount={singleMetrics.liveCount}
                statusDotClass={singleStatusDotClass}
              />
              <div className="flex items-center gap-2 shrink-0">
                <Input
                  variant="flat"
                  size="sm"
                  value={searchQuery}
                  placeholder={t('page.proxies.searchNodes')}
                  aria-label={t('page.proxies.searchNodes')}
                  isClearable
                  onValueChange={setSearchQuery}
                  startContent={<IoSearchOutline className="text-default-400 text-sm shrink-0" />}
                  className="w-[150px] sm:w-[190px]"
                  classNames={CARD_STYLES.GLASS_INPUT}
                />
                <Button
                  variant="flat"
                  color="primary"
                  size="sm"
                  isIconOnly
                  radius="lg"
                  aria-label={t('proxies.testGroup')}
                  title={t('proxies.testGroup')}
                  className={`h-8 w-8 min-w-8 ${CARD_STYLES.GLASS_TOOLBAR_BUTTON} bg-primary/10 hover:bg-primary/20 text-primary shadow-sm`}
                  onPress={() => void onGroupDelay(singleGroup)}
                  isDisabled={!!delaying[singleGroup.name]}
                >
                  {delaying[singleGroup.name] ? (
                    <div className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                  ) : (
                    <MdOutlineSpeed className="text-lg" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            {proxyChunks.length === 0 ? (
              <EmptyState
                icon={<IoSearchOutline className="!text-[36px] text-default-400" />}
                title={t('page.proxies.noMatchingNodes')}
                description={t('page.proxies.noMatchingNodesDescription')}
              />
            ) : (
              <Virtuoso
                ref={virtuosoRef}
                data={proxyChunks}
                itemContent={renderChunk}
                components={VIRTUOSO_COMPONENTS}
              />
            )}
          </div>
        </div>
      ) : (
        <div ref={splitContainerRef} className="relative h-[calc(100vh-49px)] flex overflow-hidden">
          <div
            className="flex-1 min-w-0 h-full overflow-y-auto custom-scrollbar"
            onClick={handleGridBackdropClick}
          >
            <div
              className={`grid gap-2 pt-2 pb-4 grid-cols-[repeat(auto-fill,minmax(270px,1fr))] ${
                isDrawerOpen && canPushDrawer ? 'pl-2 pr-1' : 'px-2'
              }`}
            >
              {renderGroups.map((group) => {
                const metrics = proxyGroupMetrics.get(group.name) || {
                  currentDelay: -1,
                  liveCount: 0
                }
                return (
                  <ProxyGroupCard
                    key={group.name}
                    group={group}
                    active={activeGroup?.name === group.name}
                    onOpen={() => handleOpenGroup(group.name)}
                    delaying={!!delaying[group.name]}
                    currentDelay={metrics.currentDelay}
                    liveCount={metrics.liveCount}
                    onGroupDelay={() => onGroupDelay(group)}
                  />
                )
              })}
            </div>
          </div>

          {drawerGroup && (
            <aside
              aria-label={drawerGroup.name}
              className={
                canPushDrawer
                  ? `shrink-0 my-2 flex flex-col overflow-hidden rounded-2xl border bg-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_10px_32px_rgba(0,0,0,0.3)] transition-[width,opacity,transform,margin] duration-200 ease-out motion-reduce:transition-none ${
                      drawerEntered
                        ? 'w-[calc(50%-12px)] ml-1 mr-2 border-default-200/60 dark:border-white/10 translate-x-0 opacity-100'
                        : 'w-0 ml-0 mr-0 border-transparent translate-x-4 opacity-0 pointer-events-none'
                    }`
                  : `absolute top-2 right-2 bottom-2 z-30 w-[min(460px,calc(100%-16px))] flex flex-col overflow-hidden rounded-2xl border border-white/75 dark:border-white/15 bg-white/88 dark:bg-default-100/90 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.45)] transition-all duration-200 ease-out motion-reduce:transition-none ${
                      drawerEntered
                        ? 'translate-x-0 opacity-100'
                        : 'translate-x-full opacity-0 pointer-events-none'
                    }`
              }
            >
              <div className="h-full w-full min-w-[320px] flex flex-col overflow-hidden">
                <div className="shrink-0 px-4 py-3 border-b border-default-200/50 dark:border-white/10 flex items-center justify-between gap-2">
                  <GroupDetailSummary
                    group={drawerGroup}
                    liveCount={drawerMetrics.liveCount}
                    statusDotClass={drawerStatusDotClass}
                  />

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant={showDrawerSearch || searchQuery ? 'flat' : 'light'}
                      color={showDrawerSearch || searchQuery ? 'primary' : 'default'}
                      size="sm"
                      isIconOnly
                      radius="full"
                      aria-label={t('page.proxies.searchNodes')}
                      title={t('page.proxies.searchNodes')}
                      aria-expanded={showDrawerSearch}
                      className={
                        showDrawerSearch || searchQuery
                          ? 'h-8 w-8 min-w-8 rounded-full bg-primary/10 hover:bg-primary/20 text-primary shadow-sm'
                          : 'h-8 w-8 min-w-8 rounded-full bg-default-100/70 text-default-500 shadow-sm transition-all duration-150 hover:bg-default-200/70 hover:text-foreground'
                      }
                      onPress={() => {
                        setShowDrawerSearch((prev) => {
                          const next = !prev
                          if (!next) {
                            setSearchQuery('')
                          }
                          return next
                        })
                      }}
                    >
                      <IoSearchOutline className="text-[17px]" />
                    </Button>
                    <Button
                      variant="flat"
                      color="primary"
                      size="sm"
                      isIconOnly
                      radius="full"
                      aria-label={t('proxies.testGroup')}
                      title={t('proxies.testGroup')}
                      className="h-8 w-8 min-w-8 rounded-full bg-primary/10 hover:bg-primary/20 text-primary shadow-sm"
                      onPress={() => void onGroupDelay(drawerGroup)}
                      isDisabled={!!delaying[drawerGroup.name]}
                    >
                      {delaying[drawerGroup.name] ? (
                        <div className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                      ) : (
                        <MdOutlineSpeed className="text-lg" />
                      )}
                    </Button>
                    <SecondaryModalCloseButton onPress={closeDrawer} />
                  </div>
                </div>

                {showDrawerSearch && (
                  <div className="shrink-0 px-2 pt-2 pb-0.5 animate-fade-in">
                    <Input
                      ref={drawerSearchInputRef}
                      variant="flat"
                      size="sm"
                      value={searchQuery}
                      placeholder={t('page.proxies.searchNodes')}
                      aria-label={t('page.proxies.searchNodes')}
                      isClearable
                      onValueChange={setSearchQuery}
                      startContent={<IoSearchOutline className="text-default-400 text-sm shrink-0" />}
                      classNames={DRAWER_SEARCH_INPUT_CLASSNAMES}
                    />
                  </div>
                )}

                <div className="flex-1 min-h-0">
                  {activeGroup ? (
                    proxyChunks.length === 0 ? (
                      <EmptyState
                        icon={<IoSearchOutline className="!text-[36px] text-default-400" />}
                        title={t('page.proxies.noMatchingNodes')}
                        description={t('page.proxies.noMatchingNodesDescription')}
                      />
                    ) : (
                      <Virtuoso
                        ref={virtuosoRef}
                        data={proxyChunks}
                        itemContent={renderChunk}
                        components={VIRTUOSO_COMPONENTS}
                      />
                    )
                  ) : null}
                </div>
              </div>
            </aside>
          )}
        </div>
      )}
    </BasePage>
  )
}

export default Proxies
