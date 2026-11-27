import { notifyError } from '@renderer/utils/notify'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Button,
  Input,
  Select,
  SelectItem,
  Tab,
  Tabs,
  Tooltip
} from '@heroui/react'
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  MdAdd,
  MdClose,
  MdDragIndicator,
  MdLink,
  MdRefresh,
  MdRemove,
  MdSort
} from 'react-icons/md'
import ProxyChainModal from './proxy-chain-modal'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useGroups } from '@renderer/hooks/use-groups'
import SecondaryModalCloseButton from '@renderer/components/base/secondary-modal-close'
import {
  MODAL_SECTION_INPUT_CLASSNAMES,
  MODAL_SECTION_NUMBER_INPUT_CLASSNAMES,
  MODAL_SECTION_SELECT_CLASSNAMES,
  MODAL_SECTION_TABS_CLASSNAMES,
  MODAL_SETTING_BODY_CLASSNAME,
  MODAL_SETTING_HEADER_CLASSNAME,
  MODAL_SETTING_MODAL_OVERRIDES,
  ModalSettingRow,
  ModalSettingSection
} from '@renderer/components/base/modal-setting-section'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  createSecondaryModalClassNames,
  getMainPaneModalContentStyle,
  SECONDARY_MODAL_HEADER_CLASSNAME
} from '@renderer/utils/modal-styles'
import { useI18n } from '@renderer/i18n'
import AppSwitch from '@renderer/components/base/app-switch'

const DEFAULT_DELAY_TEST_CONCURRENCY = 4
const MIN_DELAY_TEST_CONCURRENCY = 1
const MAX_DELAY_TEST_CONCURRENCY = 8

const DEFAULT_DELAY_TEST_TIMEOUT = 5000
const MIN_DELAY_TEST_TIMEOUT = 1000
const MAX_DELAY_TEST_TIMEOUT = 15000

const DEFAULT_DELAY_THRESHOLDS = { good: 200, fair: 500 }

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

function normalizeThresholdPair(
  rawGood: string,
  rawFair: string,
  fallback: { good: number; fair: number },
  editedField: 'good' | 'fair'
): { good: number; fair: number } {
  const parsedGood = Number.parseInt(rawGood, 10)
  const parsedFair = Number.parseInt(rawFair, 10)

  let good = clampInt(Number.isFinite(parsedGood) ? parsedGood : fallback.good, 1, 14999)
  let fair = clampInt(Number.isFinite(parsedFair) ? parsedFair : fallback.fair, 2, 15000)

  if (editedField === 'good' && good >= fair) {
    fair = Math.min(15000, good + 1)
    if (good >= fair) {
      good = fair - 1
    }
  } else if (fair <= good) {
    fair = Math.min(15000, good + 1)
  }

  return { good, fair }
}

interface Props {
  onClose: () => void
}

const ProxySettingModal: React.FC<Props> = (props) => {
  const { onClose } = props
  const { t } = useI18n()
  const { appConfig, patchAppConfig } = useAppConfig()
  const { groups: allGroups = [] } = useGroups()

  const {
    collapseSidebar = false,
    siderWidth = 220,
    proxyCols = 'auto',
    proxyDisplayOrder = 'default',
    autoCloseConnection = true,
    delayTestUrl = '',
    delayTestConcurrency = DEFAULT_DELAY_TEST_CONCURRENCY,
    delayTestTimeout = DEFAULT_DELAY_TEST_TIMEOUT,
    delayThresholds = DEFAULT_DELAY_THRESHOLDS,
    groupOrder = [],
    autoDelayTestOnShow = true
  } = appConfig || {}

  // 过滤掉 GLOBAL 组
  const groups = useMemo(() => allGroups.filter((g) => g.name !== 'GLOBAL'), [allGroups])

  const savedConcurrency = clampInt(
    delayTestConcurrency ?? DEFAULT_DELAY_TEST_CONCURRENCY,
    MIN_DELAY_TEST_CONCURRENCY,
    MAX_DELAY_TEST_CONCURRENCY
  )
  const savedTimeout = clampInt(
    delayTestTimeout ?? DEFAULT_DELAY_TEST_TIMEOUT,
    MIN_DELAY_TEST_TIMEOUT,
    MAX_DELAY_TEST_TIMEOUT
  )

  const [url, setUrl] = useState(delayTestUrl ?? '')
  const [concurrencyInput, setConcurrencyInput] = useState(savedConcurrency.toString())
  const [timeoutInput, setTimeoutInput] = useState(savedTimeout.toString())
  const [goodThreshold, setGoodThreshold] = useState(delayThresholds.good.toString())
  const [fairThreshold, setFairThreshold] = useState(delayThresholds.fair.toString())
  const [showSortModal, setShowSortModal] = useState(false)
  const [showChainModal, setShowChainModal] = useState(false)

  const urlRef = useRef(url)
  urlRef.current = url
  const savedUrlRef = useRef(delayTestUrl ?? '')
  savedUrlRef.current = delayTestUrl ?? ''
  const urlTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const commitUrl = useCallback(
    (nextRawUrl: string) => {
      if (urlTimerRef.current !== null) {
        clearTimeout(urlTimerRef.current)
        urlTimerRef.current = null
      }
      const nextUrl = nextRawUrl.trim()
      if (nextUrl === savedUrlRef.current.trim()) return
      savedUrlRef.current = nextUrl
      patchAppConfig({ delayTestUrl: nextUrl }).catch((error) => notifyError(error))
    },
    [patchAppConfig]
  )

  const scheduleUrlSave = useCallback(
    (nextRawUrl: string) => {
      if (urlTimerRef.current !== null) {
        clearTimeout(urlTimerRef.current)
      }
      urlTimerRef.current = setTimeout(() => {
        urlTimerRef.current = null
        const nextUrl = nextRawUrl.trim()
        if (nextUrl === savedUrlRef.current.trim()) return
        savedUrlRef.current = nextUrl
        patchAppConfig({ delayTestUrl: nextUrl }).catch((error) => notifyError(error))
      }, 500)
    },
    [patchAppConfig]
  )

  useEffect(() => {
    setUrl(delayTestUrl ?? '')
  }, [delayTestUrl])

  // 组件卸载或关闭弹窗前刷新挂起的测速地址保存，防止修改后立即关闭丢失
  useEffect(() => {
    return () => {
      if (urlTimerRef.current !== null) {
        commitUrl(urlRef.current)
      }
    }
  }, [commitUrl])

  useEffect(() => {
    setConcurrencyInput(savedConcurrency.toString())
  }, [savedConcurrency])

  useEffect(() => {
    setTimeoutInput(savedTimeout.toString())
  }, [savedTimeout])

  useEffect(() => {
    setGoodThreshold(delayThresholds.good.toString())
    setFairThreshold(delayThresholds.fair.toString())
  }, [delayThresholds.good, delayThresholds.fair])

  const commitConcurrency = useCallback(
    (raw = concurrencyInput) => {
      const parsed = Number.parseInt(raw, 10)
      const next = Number.isFinite(parsed)
        ? clampInt(parsed, MIN_DELAY_TEST_CONCURRENCY, MAX_DELAY_TEST_CONCURRENCY)
        : savedConcurrency
      setConcurrencyInput(next.toString())
      if (next !== savedConcurrency) {
        patchAppConfig({ delayTestConcurrency: next }).catch((error) => notifyError(error))
      }
    },
    [concurrencyInput, patchAppConfig, savedConcurrency]
  )

  const stepConcurrency = useCallback(
    (delta: number) => {
      const parsed = Number.parseInt(concurrencyInput, 10)
      const base = Number.isFinite(parsed) ? parsed : savedConcurrency
      const next = clampInt(base + delta, MIN_DELAY_TEST_CONCURRENCY, MAX_DELAY_TEST_CONCURRENCY)
      setConcurrencyInput(next.toString())
      if (next !== savedConcurrency) {
        patchAppConfig({ delayTestConcurrency: next }).catch((error) => notifyError(error))
      }
    },
    [concurrencyInput, patchAppConfig, savedConcurrency]
  )

  const commitTimeout = useCallback(
    (raw = timeoutInput) => {
      const parsed = Number.parseInt(raw, 10)
      const next = Number.isFinite(parsed)
        ? clampInt(parsed, MIN_DELAY_TEST_TIMEOUT, MAX_DELAY_TEST_TIMEOUT)
        : DEFAULT_DELAY_TEST_TIMEOUT
      setTimeoutInput(next.toString())
      if (next !== savedTimeout) {
        patchAppConfig({ delayTestTimeout: next }).catch((error) => notifyError(error))
      }
    },
    [patchAppConfig, savedTimeout, timeoutInput]
  )

  const commitThresholds = useCallback(
    (editedField: 'good' | 'fair') => {
      const { good, fair } = normalizeThresholdPair(
        goodThreshold,
        fairThreshold,
        delayThresholds,
        editedField
      )
      setGoodThreshold(good.toString())
      setFairThreshold(fair.toString())
      if (good !== delayThresholds.good || fair !== delayThresholds.fair) {
        patchAppConfig({ delayThresholds: { good, fair } }).catch((error) => notifyError(error))
      }
    },
    [delayThresholds, fairThreshold, goodThreshold, patchAppConfig]
  )

  const parsedConcurrency = Number.parseInt(concurrencyInput, 10)
  const effectiveConcurrency = Number.isFinite(parsedConcurrency)
    ? clampInt(parsedConcurrency, MIN_DELAY_TEST_CONCURRENCY, MAX_DELAY_TEST_CONCURRENCY)
    : savedConcurrency

  return (
    <>
      <Modal
        backdrop="blur"
        classNames={createSecondaryModalClassNames(MODAL_SETTING_MODAL_OVERRIDES)}
        size="xl"
        hideCloseButton
        isOpen={true}
        onOpenChange={onClose}
        scrollBehavior="inside"
      >
        <ModalContent
          style={getMainPaneModalContentStyle({ collapseSidebar, siderWidth, maxWidthPx: 800 })}
        >
          <ModalHeader className={MODAL_SETTING_HEADER_CLASSNAME}>
            <span>{t('page.proxies.settings')}</span>
            <SecondaryModalCloseButton onPress={onClose} />
          </ModalHeader>
          <ModalBody className={MODAL_SETTING_BODY_CLASSNAME}>
            <ModalSettingSection title={t('proxies.section.view')}>
              <ModalSettingRow title={t('proxies.columns')}>
                <Select
                  aria-label={t('proxies.columns')}
                  classNames={MODAL_SECTION_SELECT_CLASSNAMES}
                  className="w-full sm:w-[150px]"
                  size="sm"
                  selectedKeys={new Set([proxyCols])}
                  disallowEmptySelection={true}
                  onSelectionChange={async (v) => {
                    try {
                      await patchAppConfig({
                        proxyCols: v.currentKey as 'auto' | '1' | '2' | '3' | '4'
                      })
                    } catch (error) {
                      notifyError(error)
                    }
                  }}
                >
                  <SelectItem key="auto">{t('proxies.column.auto')}</SelectItem>
                  <SelectItem key="1">{t('proxies.column.one')}</SelectItem>
                  <SelectItem key="2">{t('proxies.column.two')}</SelectItem>
                  <SelectItem key="3">{t('proxies.column.three')}</SelectItem>
                  <SelectItem key="4">{t('proxies.column.four')}</SelectItem>
                </Select>
              </ModalSettingRow>

              <ModalSettingRow title={t('proxies.sortMode')}>
                <Tabs
                  aria-label={t('proxies.sortMode')}
                  size="sm"
                  classNames={MODAL_SECTION_TABS_CLASSNAMES}
                  selectedKey={proxyDisplayOrder}
                  onSelectionChange={async (v) => {
                    try {
                      await patchAppConfig({
                        proxyDisplayOrder: v as 'default' | 'delay' | 'name'
                      })
                    } catch (error) {
                      notifyError(error)
                    }
                  }}
                >
                  <Tab key="default" title={t('proxies.sort.default')} />
                  <Tab key="delay" title={t('proxies.sort.delay')} />
                  <Tab key="name" title={t('proxies.sort.name')} />
                </Tabs>
              </ModalSettingRow>

              <ModalSettingRow
                title={t('proxies.groupOrder')}
                hint={
                  groupOrder.length > 0
                    ? t('proxies.groupOrderCustom', { count: groupOrder.length })
                    : undefined
                }
              >
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    color="primary"
                    variant="flat"
                    radius="full"
                    startContent={<MdSort className="text-base" />}
                    onPress={() => setShowSortModal(true)}
                  >
                    {t('proxies.adjustOrder')}
                  </Button>
                  <Button
                    size="sm"
                    color="default"
                    variant="flat"
                    radius="full"
                    isDisabled={groupOrder.length === 0}
                    startContent={<MdRefresh className="text-base" />}
                    onPress={() => {
                      patchAppConfig({ groupOrder: [] }).catch((error) => notifyError(error))
                    }}
                  >
                    {t('common.reset')}
                  </Button>
                </div>
              </ModalSettingRow>
            </ModalSettingSection>

            <ModalSettingSection title={t('proxies.section.behavior')}>
              <ModalSettingRow title={t('page.proxies.manageChains')}>
                <Button
                  size="sm"
                  color="primary"
                  variant="flat"
                  radius="full"
                  startContent={<MdLink className="text-base" />}
                  onPress={() => setShowChainModal(true)}
                >
                  {t('common.manage')}
                </Button>
              </ModalSettingRow>

              <ModalSettingRow title={t('proxies.autoCloseConnection')}>
                <AppSwitch
                  size="sm"
                  aria-label={t('proxies.autoCloseConnection')}
                  isSelected={autoCloseConnection}
                  onValueChange={(v) => {
                    patchAppConfig({ autoCloseConnection: v }).catch((error) => notifyError(error))
                  }}
                />
              </ModalSettingRow>

              <ModalSettingRow title={t('proxies.autoDelayTest')}>
                <AppSwitch
                  size="sm"
                  aria-label={t('proxies.autoDelayTest')}
                  isSelected={autoDelayTestOnShow}
                  onValueChange={(v) => {
                    patchAppConfig({ autoDelayTestOnShow: v }).catch((error) => notifyError(error))
                  }}
                />
              </ModalSettingRow>
            </ModalSettingSection>

            <ModalSettingSection title={t('proxies.section.delayTest')}>
              <ModalSettingRow title={t('proxies.delayTestUrl')}>
                <Input
                  size="sm"
                  aria-label={t('proxies.delayTestUrl')}
                  className="w-full sm:w-[340px]"
                  classNames={MODAL_SECTION_INPUT_CLASSNAMES}
                  value={url}
                  placeholder={t('proxies.delayTestUrlPlaceholder')}
                  onValueChange={(v) => {
                    setUrl(v)
                    scheduleUrlSave(v)
                  }}
                  onBlur={() => commitUrl(url)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      commitUrl(url)
                    }
                  }}
                  endContent={
                    url.trim().length > 0 ? (
                      <Tooltip content={t('proxies.resetToDefault')}>
                        <button
                          type="button"
                          aria-label={t('proxies.resetToDefault')}
                          className="rounded-full p-0.5 text-default-400 transition-colors hover:bg-default-200/70 hover:text-foreground"
                          onClick={() => {
                            setUrl('')
                            commitUrl('')
                          }}
                        >
                          <MdClose className="text-sm" />
                        </button>
                      </Tooltip>
                    ) : null
                  }
                />
              </ModalSettingRow>

              <ModalSettingRow
                title={t('proxies.delayTestConcurrency')}
                hint={t('proxies.delayTestConcurrencyHelp')}
              >
                <div className="flex items-center gap-1.5">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="flat"
                    radius="full"
                    aria-label={t('proxies.concurrencyDecrease')}
                    isDisabled={effectiveConcurrency <= MIN_DELAY_TEST_CONCURRENCY}
                    onPress={() => stepConcurrency(-1)}
                    className="h-8 w-8 min-w-8 bg-default-100/90 text-default-600 hover:bg-default-200/80 dark:bg-white/[0.08] dark:text-default-300 dark:hover:bg-white/[0.14]"
                  >
                    <MdRemove className="text-base" />
                  </Button>
                  <Input
                    type="number"
                    size="sm"
                    aria-label={t('proxies.delayTestConcurrency')}
                    className="w-[68px]"
                    classNames={{
                      ...MODAL_SECTION_NUMBER_INPUT_CLASSNAMES,
                      input: `${MODAL_SECTION_NUMBER_INPUT_CLASSNAMES.input} text-center font-medium`
                    }}
                    min={MIN_DELAY_TEST_CONCURRENCY}
                    max={MAX_DELAY_TEST_CONCURRENCY}
                    value={concurrencyInput}
                    placeholder={DEFAULT_DELAY_TEST_CONCURRENCY.toString()}
                    onValueChange={setConcurrencyInput}
                    onBlur={() => commitConcurrency()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        commitConcurrency()
                      }
                    }}
                  />
                  <Button
                    isIconOnly
                    size="sm"
                    variant="flat"
                    radius="full"
                    aria-label={t('proxies.concurrencyIncrease')}
                    isDisabled={effectiveConcurrency >= MAX_DELAY_TEST_CONCURRENCY}
                    onPress={() => stepConcurrency(1)}
                    className="h-8 w-8 min-w-8 bg-default-100/90 text-default-600 hover:bg-default-200/80 dark:bg-white/[0.08] dark:text-default-300 dark:hover:bg-white/[0.14]"
                  >
                    <MdAdd className="text-base" />
                  </Button>
                </div>
              </ModalSettingRow>

              <ModalSettingRow
                title={t('proxies.delayTestTimeout')}
                hint={t('proxies.delayTestTimeoutHelp')}
              >
                <Input
                  type="number"
                  size="sm"
                  aria-label={t('proxies.delayTestTimeout')}
                  className="w-full sm:w-[136px]"
                  classNames={MODAL_SECTION_NUMBER_INPUT_CLASSNAMES}
                  min={MIN_DELAY_TEST_TIMEOUT}
                  max={MAX_DELAY_TEST_TIMEOUT}
                  value={timeoutInput}
                  placeholder={DEFAULT_DELAY_TEST_TIMEOUT.toString()}
                  endContent={<span className="select-none text-xs text-default-400">ms</span>}
                  onValueChange={setTimeoutInput}
                  onBlur={() => commitTimeout()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      commitTimeout()
                    }
                  }}
                />
              </ModalSettingRow>

              <ModalSettingRow title={t('proxies.delayThresholds')}>
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground-500">
                      {t('proxies.delayExcellent')}
                    </span>
                    <Input
                      size="sm"
                      type="number"
                      aria-label={t('proxies.delayExcellent')}
                      className="w-[108px]"
                      classNames={MODAL_SECTION_NUMBER_INPUT_CLASSNAMES}
                      min={1}
                      max={14999}
                      value={goodThreshold}
                      startContent={
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
                      }
                      endContent={<span className="select-none text-xs text-default-400">ms</span>}
                      onValueChange={setGoodThreshold}
                      onBlur={() => commitThresholds('good')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          commitThresholds('good')
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground-500">
                      {t('proxies.delayGood')}
                    </span>
                    <Input
                      size="sm"
                      type="number"
                      aria-label={t('proxies.delayGood')}
                      className="w-[108px]"
                      classNames={MODAL_SECTION_NUMBER_INPUT_CLASSNAMES}
                      min={2}
                      max={15000}
                      value={fairThreshold}
                      startContent={
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" />
                      }
                      endContent={<span className="select-none text-xs text-default-400">ms</span>}
                      onValueChange={setFairThreshold}
                      onBlur={() => commitThresholds('fair')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          commitThresholds('fair')
                        }
                      }}
                    />
                  </div>
                </div>
              </ModalSettingRow>
            </ModalSettingSection>
          </ModalBody>
        </ModalContent>
      </Modal>
      {showChainModal && <ProxyChainModal onClose={() => setShowChainModal(false)} />}
      {showSortModal && (
        <GroupSortModal
          groups={groups}
          groupOrder={groupOrder}
          onClose={() => setShowSortModal(false)}
          patchAppConfig={patchAppConfig}
          collapseSidebar={collapseSidebar}
          siderWidth={siderWidth}
          title={t('proxies.adjustGroupOrder')}
          description={t('proxies.dragToReorder')}
        />
      )}
    </>
  )
}

// 代理组排序弹窗
interface GroupSortModalProps {
  groups: ControllerMixedGroup[]
  groupOrder: string[]
  onClose: () => void
  patchAppConfig: (value: Partial<AppConfig>) => Promise<void>
  collapseSidebar: boolean
  siderWidth: number
  title: string
  description: string
}

const GroupSortModal: React.FC<GroupSortModalProps> = ({
  groups,
  groupOrder,
  onClose,
  patchAppConfig,
  collapseSidebar,
  siderWidth,
  title,
  description
}) => {
  const { t } = useI18n()

  const sortedGroups = useMemo(() => {
    if (groupOrder.length === 0) return groups
    const orderMap = new Map(groupOrder.map((name, index) => [name, index]))
    return [...groups].sort((a, b) => {
      const aIndex = orderMap.get(a.name) ?? Infinity
      const bIndex = orderMap.get(b.name) ?? Infinity
      return aIndex - bIndex
    })
  }, [groups, groupOrder])

  const sortedGroupNames = useMemo(() => sortedGroups.map((g) => g.name), [sortedGroups])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = async (event: DragEndEvent) => {
    try {
      const { active, over } = event
      if (over && active.id !== over.id) {
        const oldIndex = sortedGroupNames.indexOf(active.id as string)
        const newIndex = sortedGroupNames.indexOf(over.id as string)
        const newOrder = arrayMove(sortedGroupNames, oldIndex, newIndex)
        await patchAppConfig({ groupOrder: newOrder })
      }
    } catch (error) {
      notifyError(error)
    }
  }

  return (
    <Modal
      backdrop="blur"
      classNames={createSecondaryModalClassNames()}
      size="sm"
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent
        style={getMainPaneModalContentStyle({ collapseSidebar, siderWidth, maxWidthPx: 520 })}
      >
        <ModalHeader className={SECONDARY_MODAL_HEADER_CLASSNAME}>
          <div className="min-w-0">
            <div className="truncate">{title}</div>
            <div className="mt-0.5 text-xs font-normal text-foreground-500">{description}</div>
          </div>
          <SecondaryModalCloseButton onPress={onClose} />
        </ModalHeader>
        <ModalBody className="px-6 pt-1 pb-6">
          {sortedGroups.length === 0 ? (
            <div className="rounded-2xl border border-default-200/60 bg-default-100/40 px-4 py-8 text-center text-sm text-foreground-400 dark:border-white/10 dark:bg-white/[0.03]">
              {t('proxies.noGroupsToSort')}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={sortedGroupNames} strategy={verticalListSortingStrategy}>
                <div className="flex max-h-[400px] flex-col gap-1.5 overflow-y-auto pr-1">
                  {sortedGroups.map((group, index) => (
                    <SortableGroupItem
                      key={group.name}
                      name={group.name}
                      nodeCount={group.all?.length ?? 0}
                      index={index}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

// 可排序的组项目
interface SortableGroupItemProps {
  name: string
  nodeCount: number
  index: number
}

const SortableGroupItem: React.FC<SortableGroupItemProps> = ({ name, nodeCount, index }) => {
  const { t } = useI18n()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: name
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : undefined,
    opacity: isDragging ? 0.6 : 1
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center gap-2.5 rounded-xl border border-default-200/50 bg-default-100/60 px-3 py-2 cursor-grab transition-colors hover:bg-default-200/60 active:cursor-grabbing dark:border-white/10 dark:bg-white/[0.05] dark:hover:bg-white/[0.09]"
    >
      <MdDragIndicator className="shrink-0 text-base text-foreground-400" />
      <span className="w-5 shrink-0 text-center text-xs font-medium text-foreground-400">
        {index + 1}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
      <span className="shrink-0 text-xs text-foreground-400">
        {t('proxies.groupNodeCount', { count: nodeCount })}
      </span>
    </div>
  )
}

export default ProxySettingModal
