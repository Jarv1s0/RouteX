import { Modal, ModalContent, ModalHeader, ModalBody, Button, Input, Select, SelectItem, Tab, Tabs } from '@heroui/react'
import React, { useState, useEffect, useMemo } from 'react'
import { MdLink, MdRefresh, MdSort } from 'react-icons/md'
import SettingItem from '../base/base-setting-item'
import ProxyChainModal from './proxy-chain-modal'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useGroups } from '@renderer/hooks/use-groups'
import debounce from '@renderer/utils/debounce'
import SecondaryModalCloseButton from '@renderer/components/base/secondary-modal-close'

import { secondaryInputClassNames, numberInputClassNames } from '../settings/advanced-settings'
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
const MAX_DELAY_TEST_CONCURRENCY = 8
const DEFAULT_DELAY_TEST_TIMEOUT = 5000

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
    siderWidth = 250,
    proxyCols = 'auto',
    proxyDisplayOrder = 'default',

    autoCloseConnection = true,
    delayTestUrl,
    delayTestConcurrency,
    delayTestTimeout,
    delayThresholds = { good: 200, fair: 500 },
    groupOrder = [],
    autoDelayTestOnShow = true
  } = appConfig || {}

  // 过滤掉 GLOBAL 组
  const groups = useMemo(() => allGroups.filter((g) => g.name !== 'GLOBAL'), [allGroups])

  const [url, setUrl] = useState(delayTestUrl ?? '')
  const [goodThreshold, setGoodThreshold] = useState(delayThresholds.good.toString())
  const [fairThreshold, setFairThreshold] = useState(delayThresholds.fair.toString())
  const [showSortModal, setShowSortModal] = useState(false)
  const [showChainModal, setShowChainModal] = useState(false)

  const setUrlDebounce = useMemo(
    () =>
      debounce((v: string) => {
        patchAppConfig({ delayTestUrl: v })
      }, 500),
    [patchAppConfig]
  )

  useEffect(() => {
    setUrl(delayTestUrl ?? '')
  }, [delayTestUrl])

  useEffect(() => {
    setGoodThreshold(delayThresholds.good.toString())
    setFairThreshold(delayThresholds.fair.toString())
  }, [delayThresholds.good, delayThresholds.fair])

  return (
    <>
      <Modal
        backdrop="blur"
        classNames={createSecondaryModalClassNames()}
        size="xl"
        hideCloseButton
        isOpen={true}
        onOpenChange={onClose}
        scrollBehavior="inside"
      >
        <ModalContent
          style={getMainPaneModalContentStyle({ collapseSidebar, siderWidth, maxWidthPx: 820 })}
        >
          <ModalHeader className={SECONDARY_MODAL_HEADER_CLASSNAME}>
            <span>{t('page.proxies.settings')}</span>
            <SecondaryModalCloseButton onPress={onClose} />
          </ModalHeader>
          <ModalBody className="py-2 gap-1 pb-2 px-6">
            <SettingItem title={t('page.proxies.manageChains')} divider>
              <Button
                size="sm"
                color="primary"
                variant="flat"
                startContent={<MdLink className="text-lg" />}
                onPress={() => setShowChainModal(true)}
              >
                {t('common.manage')}
              </Button>
            </SettingItem>
            <SettingItem title={t('proxies.columns')} divider>
              <Select
                classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
                className="w-[150px]"
                size="sm"
                selectedKeys={new Set([proxyCols])}
                disallowEmptySelection={true}
                onSelectionChange={async (v) => {
                  await patchAppConfig({
                    proxyCols: v.currentKey as 'auto' | '1' | '2' | '3' | '4'
                  })
                }}
              >
                <SelectItem key="auto">{t('proxies.column.auto')}</SelectItem>
                <SelectItem key="1">{t('proxies.column.one')}</SelectItem>
                <SelectItem key="2">{t('proxies.column.two')}</SelectItem>
                <SelectItem key="3">{t('proxies.column.three')}</SelectItem>
                <SelectItem key="4">{t('proxies.column.four')}</SelectItem>
              </Select>
            </SettingItem>
            <SettingItem title={t('proxies.sortMode')} divider>
              <Tabs
                size="sm"
                color="primary"
                variant="solid"
                radius="lg"
                selectedKey={proxyDisplayOrder}
                onSelectionChange={async (v) => {
                  await patchAppConfig({
                    proxyDisplayOrder: v as 'default' | 'delay' | 'name'
                  })
                }}
              >
                <Tab key="default" title={t('proxies.sort.default')} />
                <Tab key="delay" title={t('proxies.sort.delay')} />
                <Tab key="name" title={t('proxies.sort.name')} />
              </Tabs>
            </SettingItem>

            <SettingItem title={t('proxies.autoCloseConnection')} divider>
              <AppSwitch
                size="sm"
                isSelected={autoCloseConnection}
                onValueChange={(v) => {
                  patchAppConfig({ autoCloseConnection: v })
                }}
              />
            </SettingItem>
            <SettingItem title={t('proxies.autoDelayTest')} divider>
              <AppSwitch
                size="sm"
                isSelected={autoDelayTestOnShow}
                onValueChange={(v) => {
                  patchAppConfig({ autoDelayTestOnShow: v })
                }}
              />
            </SettingItem>
            <SettingItem title={t('proxies.delayTestUrl')} divider>
              <Input
                size="sm"
                className="w-[350px]"
                classNames={secondaryInputClassNames}
                value={url}
                placeholder={t('proxies.delayTestUrlPlaceholder')}
                onValueChange={(v) => {
                  setUrl(v)
                  setUrlDebounce(v)
                }}
              />
            </SettingItem>
            <SettingItem
              title={
                <>
                  {t('proxies.delayTestConcurrency')}
                  <span className="text-xs text-foreground-400 font-normal ml-1">
                    {t('proxies.delayTestConcurrencyHelp')}
                  </span>
                </>
              }
              divider
            >
              <Input
                type="number"
                size="sm"
                className="w-[120px]"
                classNames={numberInputClassNames}
                min={1}
                max={MAX_DELAY_TEST_CONCURRENCY}
                value={delayTestConcurrency?.toString()}
                placeholder={t('connections.defaultInterval', {
                  value: DEFAULT_DELAY_TEST_CONCURRENCY
                })}
                onValueChange={(v) => {
                  const parsed = Number.parseInt(v, 10)
                  patchAppConfig({
                    delayTestConcurrency: Number.isFinite(parsed)
                      ? Math.min(MAX_DELAY_TEST_CONCURRENCY, Math.max(1, parsed))
                      : DEFAULT_DELAY_TEST_CONCURRENCY
                  })
                }}
              />
            </SettingItem>
            <SettingItem
              title={
                <>
                  {t('proxies.delayTestTimeout')}
                  <span className="text-xs text-foreground-400 font-normal ml-1">
                    {t('proxies.delayTestTimeoutHelp')}
                  </span>
                </>
              }
              divider
            >
              <Input
                type="number"
                size="sm"
                className="w-[120px]"
                classNames={numberInputClassNames}
                value={delayTestTimeout?.toString()}
                placeholder={t('connections.defaultInterval', {
                  value: DEFAULT_DELAY_TEST_TIMEOUT
                })}
                onValueChange={(v) => {
                  const parsed = Number.parseInt(v, 10)
                  patchAppConfig({
                    delayTestTimeout: Number.isFinite(parsed) ? parsed : DEFAULT_DELAY_TEST_TIMEOUT
                  })
                }}
              />
            </SettingItem>
            <SettingItem title={t('proxies.delayThresholds')} divider>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span className="text-xs text-foreground-500">{t('proxies.delayExcellent')}</span>
                  <Input
                    size="sm"
                    type="number"
                    className="w-[80px]"
                    classNames={numberInputClassNames}
                    value={goodThreshold}
                    onValueChange={setGoodThreshold}
                    onBlur={() => {
                      const good = Math.max(1, parseInt(goodThreshold) || 200)
                      const fair = Math.max(good + 1, delayThresholds.fair)
                      setGoodThreshold(good.toString())
                      patchAppConfig({ delayThresholds: { good, fair } })
                    }}
                  />
                  <span className="text-xs text-foreground-400">ms</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                  <span className="text-xs text-foreground-500">{t('proxies.delayGood')}</span>
                  <Input
                    size="sm"
                    type="number"
                    className="w-[80px]"
                    classNames={numberInputClassNames}
                    value={fairThreshold}
                    onValueChange={setFairThreshold}
                    onBlur={() => {
                      const fair = Math.max(
                        delayThresholds.good + 1,
                        parseInt(fairThreshold) || 500
                      )
                      setFairThreshold(fair.toString())
                      patchAppConfig({ delayThresholds: { ...delayThresholds, fair } })
                    }}
                  />
                  <span className="text-xs text-foreground-400">ms</span>
                </div>
              </div>
            </SettingItem>
            <SettingItem title={t('proxies.groupOrder')} divider>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  color="primary"
                  variant="flat"
                  startContent={<MdSort className="text-lg" />}
                  onPress={() => setShowSortModal(true)}
                >
                  {t('proxies.adjustOrder')}
                </Button>
                <Button
                  size="sm"
                  color="default"
                  variant="flat"
                  isDisabled={groupOrder.length === 0}
                  startContent={<MdRefresh className="text-lg" />}
                  onPress={() => {
                    patchAppConfig({ groupOrder: [] })
                  }}
                >
                  {t('common.reset')}
                </Button>
              </div>
            </SettingItem>
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
  const sortedGroupNames = useMemo(() => {
    const names = groups.map((g) => g.name)
    if (groupOrder.length === 0) return names
    const orderMap = new Map(groupOrder.map((name, index) => [name, index]))
    return [...names].sort((a, b) => {
      const aIndex = orderMap.get(a) ?? Infinity
      const bIndex = orderMap.get(b) ?? Infinity
      return aIndex - bIndex
    })
  }, [groups, groupOrder])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = sortedGroupNames.indexOf(active.id as string)
      const newIndex = sortedGroupNames.indexOf(over.id as string)
      const newOrder = arrayMove(sortedGroupNames, oldIndex, newIndex)
      await patchAppConfig({ groupOrder: newOrder })
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
          <div className="flex items-end gap-2">
            <span>{title}</span>
            <span className="text-xs text-foreground-500 font-normal mb-0.5">{description}</span>
          </div>
          <SecondaryModalCloseButton onPress={onClose} />
        </ModalHeader>
        <ModalBody className="pb-2 pt-0 px-6">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortedGroupNames} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-1.5 max-h-[400px] overflow-y-auto pr-1">
                {sortedGroupNames.map((name, index) => (
                  <SortableGroupItem key={name} name={name} index={index} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

// 可排序的组项目
interface SortableGroupItemProps {
  name: string
  index: number
}

const SortableGroupItem: React.FC<SortableGroupItemProps> = ({ name, index }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: name
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : undefined,
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center gap-3 px-3 py-2 bg-content2 rounded-lg cursor-grab active:cursor-grabbing hover:bg-content3"
    >
      <span className="text-xs text-foreground-400 w-5 text-center">{index + 1}</span>
      <span className="text-sm flex-1 truncate">{name}</span>
    </div>
  )
}

export default ProxySettingModal
