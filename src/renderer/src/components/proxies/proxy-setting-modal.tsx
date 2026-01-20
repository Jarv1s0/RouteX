import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Button,
  Switch,
  Input,
  Select,
  SelectItem,
  Tab,
  Tabs
} from '@heroui/react'
import React, { useState, useEffect, useMemo } from 'react'
import { IoClose } from 'react-icons/io5'
import { MdRefresh, MdSort } from 'react-icons/md'
import SettingItem from '../base/base-setting-item'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useGroups } from '@renderer/hooks/use-groups'
import debounce from '@renderer/utils/debounce'
import { secondaryInputClassNames } from '../settings/advanced-settings'
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

// 数字输入框样式，隐藏上下箭头
const numberInputClassNames = {
  input: 'bg-transparent [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]',
  inputWrapper: 'border border-default-200 bg-default-50 hover:bg-default-100 data-[focus=true]:bg-default-50'
}

interface Props {
  onClose: () => void
}

const ProxySettingModal: React.FC<Props> = (props) => {
  const { onClose } = props
  const { appConfig, patchAppConfig } = useAppConfig()
  const { groups: allGroups = [] } = useGroups()

  const {
    proxyCols = 'auto',
    proxyDisplayOrder = 'default',

    autoCloseConnection = true,
    delayTestUrl,
    delayTestConcurrency,
    delayTestTimeout,
    delayThresholds = { good: 200, fair: 500 },
    groupOrder = [],
    autoDelayTestOnShow = false
  } = appConfig || {}

  // 过滤掉 GLOBAL 组
  const groups = useMemo(() => allGroups.filter(g => g.name !== 'GLOBAL'), [allGroups])

  const [url, setUrl] = useState(delayTestUrl ?? '')
  const [goodThreshold, setGoodThreshold] = useState(delayThresholds.good.toString())
  const [fairThreshold, setFairThreshold] = useState(delayThresholds.fair.toString())
  const [showSortModal, setShowSortModal] = useState(false)

  const setUrlDebounce = debounce((v: string) => {
    patchAppConfig({ delayTestUrl: v })
  }, 500)

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
        classNames={{ backdrop: 'top-[48px]' }}
        size="xl"
        hideCloseButton
        isOpen={true}
        onOpenChange={onClose}
        scrollBehavior="inside"
      >
        <ModalContent className="flag-emoji">
          <ModalHeader className="flex justify-between items-center pr-4">
            <span>代理组设置</span>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={onClose}
            >
              <IoClose className="text-lg" />
            </Button>
          </ModalHeader>
          <ModalBody className="py-2 pb-6 gap-1">
            <SettingItem title="代理节点展示列数" divider>
              <Select
                classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
                className="w-[150px]"
                size="sm"
                selectedKeys={new Set([proxyCols])}
                disallowEmptySelection={true}
                onSelectionChange={async (v) => {
                  await patchAppConfig({ proxyCols: v.currentKey as 'auto' | '1' | '2' | '3' | '4' })
                }}
              >
                <SelectItem key="auto">自动</SelectItem>
                <SelectItem key="1">一列</SelectItem>
                <SelectItem key="2">两列</SelectItem>
                <SelectItem key="3">三列</SelectItem>
                <SelectItem key="4">四列</SelectItem>
              </Select>
            </SettingItem>
            <SettingItem title="节点排序方式" divider>
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
                <Tab key="default" title="默认" />
                <Tab key="delay" title="延迟" />
                <Tab key="name" title="名称" />
              </Tabs>
            </SettingItem>

            <SettingItem title="切换节点时断开连接" divider>
              <Switch
                size="sm"
                isSelected={autoCloseConnection}
                onValueChange={(v) => {
                  patchAppConfig({ autoCloseConnection: v })
                }}
              />
            </SettingItem>
            <SettingItem title="进入页面时自动测速" divider>
              <Switch
                size="sm"
                isSelected={autoDelayTestOnShow}
                onValueChange={(v) => {
                  patchAppConfig({ autoDelayTestOnShow: v })
                }}
              />
            </SettingItem>
            <SettingItem title="延迟测试地址" divider>
              <Input
                size="sm"
                className="w-[60%]"
                classNames={secondaryInputClassNames}
                value={url}
                placeholder="默认 https://www.gstatic.com/generate_204"
                onValueChange={(v) => {
                  setUrl(v)
                  setUrlDebounce(v)
                }}
              />
            </SettingItem>
            <SettingItem title="延迟测试并发数量" divider>
              <Input
                type="number"
                size="sm"
                className="w-[100px]"
                classNames={numberInputClassNames}
                value={delayTestConcurrency?.toString()}
                placeholder="默认 50"
                onValueChange={(v) => {
                  patchAppConfig({ delayTestConcurrency: parseInt(v) })
                }}
              />
            </SettingItem>
            <SettingItem title="延迟测试超时时间" divider>
              <Input
                type="number"
                size="sm"
                className="w-[100px]"
                classNames={numberInputClassNames}
                value={delayTestTimeout?.toString()}
                placeholder="默认 10000"
                onValueChange={(v) => {
                  patchAppConfig({ delayTestTimeout: parseInt(v) })
                }}
              />
            </SettingItem>
            <SettingItem title="延迟颜色阈值" divider>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span className="text-xs text-foreground-500">优秀</span>
                  <Input
                    size="sm"
                    type="number"
                    className="w-[60px]"
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
                  <span className="text-xs text-foreground-500">良好</span>
                  <Input
                    size="sm"
                    type="number"
                    className="w-[60px]"
                    classNames={numberInputClassNames}
                    value={fairThreshold}
                    onValueChange={setFairThreshold}
                    onBlur={() => {
                      const fair = Math.max(delayThresholds.good + 1, parseInt(fairThreshold) || 500)
                      setFairThreshold(fair.toString())
                      patchAppConfig({ delayThresholds: { ...delayThresholds, fair } })
                    }}
                  />
                  <span className="text-xs text-foreground-400">ms</span>
                </div>
              </div>
            </SettingItem>
            <SettingItem title="代理组排序">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  color="primary"
                  variant="flat"
                  startContent={<MdSort className="text-lg" />}
                  onPress={() => setShowSortModal(true)}
                >
                  调整顺序
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
                  重置
                </Button>
              </div>
            </SettingItem>
          </ModalBody>
        </ModalContent>
      </Modal>
      {showSortModal && (
        <GroupSortModal
          groups={groups}
          groupOrder={groupOrder}
          onClose={() => setShowSortModal(false)}
          patchAppConfig={patchAppConfig}
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
}

const GroupSortModal: React.FC<GroupSortModalProps> = ({
  groups,
  groupOrder,
  onClose,
  patchAppConfig
}) => {
  const sortedGroupNames = useMemo(() => {
    const names = groups.map(g => g.name)
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
      classNames={{ backdrop: 'top-[48px]' }}
      size="md"
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex justify-between items-center pr-4">
          <span>调整代理组顺序</span>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={onClose}
          >
            <IoClose className="text-lg" />
          </Button>
        </ModalHeader>
        <ModalBody className="py-2 pb-6">
          <div className="text-sm text-foreground-500 mb-3">拖拽调整顺序</div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortedGroupNames} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-1.5 max-h-[400px] overflow-y-auto pr-1">
                {sortedGroupNames.map((name, index) => (
                  <SortableGroupItem
                    key={name}
                    name={name}
                    index={index}
                  />
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

const SortableGroupItem: React.FC<SortableGroupItemProps> = ({
  name,
  index
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: name })

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
