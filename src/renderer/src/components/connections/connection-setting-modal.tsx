import {
  Modal,
  ModalContent,
  ModalHeader,
  Switch,
  ModalBody,
  Input,
  Chip,
  Divider,
  Button
} from '@heroui/react'
import React, { useState, useEffect, useMemo } from 'react'
import { IoClose } from 'react-icons/io5'
import SettingItem from '../base/base-setting-item'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { restartMihomoConnections } from '@renderer/utils/ipc'
import debounce from '@renderer/utils/debounce'
import { secondaryInputClassNames } from '../settings/advanced-settings'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MdDragIndicator } from 'react-icons/md'

// 所有可用的表格列
const ALL_COLUMNS = [
  { key: 'close', label: '关闭' },
  { key: 'host', label: '主机' },
  { key: 'process', label: '进程' },
  { key: 'type', label: '类型' },
  { key: 'rule', label: '规则' },
  { key: 'chains', label: '代理链' },
  { key: 'downloadSpeed', label: '下载速度' },
  { key: 'uploadSpeed', label: '上传速度' },
  { key: 'download', label: '下载' },
  { key: 'upload', label: '上传' },
  { key: 'time', label: '连接时间' },
  { key: 'sourceIP', label: '源IP' },
  { key: 'sourcePort', label: '源端口' },
  { key: 'destinationIP', label: '目标IP' },
  { key: 'sniffHost', label: '嗅探主机' },
  { key: 'inboundName', label: '入站名称' },
  { key: 'inboundUser', label: '入站用户' }
]

// 默认显示的列
export const DEFAULT_COLUMNS = ['process', 'host', 'type', 'rule', 'chains', 'downloadSpeed', 'uploadSpeed', 'download', 'upload', 'time', 'close']

interface Props {
  onClose: () => void
}

// 可排序的 Chip 组件
const SortableChip: React.FC<{
  id: string
  label: string
  isSelected: boolean
  onToggle: () => void
}> = ({ id, label, isSelected, onToggle }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : undefined
  }

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      {...attributes}
      {...listeners}
    >
      <Chip
        variant={isSelected ? 'flat' : 'bordered'}
        color={isSelected ? 'primary' : 'default'}
        radius="md"
        size="sm"
        className="cursor-grab active:cursor-grabbing select-none transition-all"
        classNames={{
          content: "flex items-center gap-1 text-xs"
        }}
        startContent={<MdDragIndicator className="text-base opacity-60" />}
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
      >
        {label}
      </Chip>
    </div>
  )
}

const ConnectionSettingModal: React.FC<Props> = (props) => {
  const { onClose } = props
  const { appConfig, patchAppConfig } = useAppConfig()

  const { 
    displayIcon = true, 
    displayAppName = true, 
    connectionInterval = 500,
    connectionTableColumns = DEFAULT_COLUMNS
  } = appConfig || {}

  const [interval, setInterval] = useState(connectionInterval?.toString() ?? '')

  useEffect(() => {
    setInterval(connectionInterval?.toString() ?? '')
  }, [connectionInterval])

  const updateInterval = useMemo(() => debounce(async (v: string) => {
    let num = parseInt(v)
    if (isNaN(num)) num = 500
    if (num < 100) num = 100
    await patchAppConfig({ connectionInterval: num })
    await restartMihomoConnections()
  }, 1000), [patchAppConfig])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  // 获取所有列的排序顺序（已选中的在前，未选中的在后）
  const sortedColumns = React.useMemo(() => {
    const selected = connectionTableColumns.filter(key => ALL_COLUMNS.find(c => c.key === key))
    const unselected = ALL_COLUMNS.filter(c => !connectionTableColumns.includes(c.key)).map(c => c.key)
    return [...selected, ...unselected]
  }, [connectionTableColumns])

  const toggleColumn = (key: string) => {
    const newColumns = connectionTableColumns.includes(key)
      ? connectionTableColumns.filter(c => c !== key)
      : [...connectionTableColumns, key]
    patchAppConfig({ connectionTableColumns: newColumns })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sortedColumns.indexOf(active.id as string)
    const newIndex = sortedColumns.indexOf(over.id as string)
    const newOrder = arrayMove(sortedColumns, oldIndex, newIndex)
    
    // 只保存已选中的列，按新顺序
    const newSelectedColumns = newOrder.filter(key => connectionTableColumns.includes(key))
    patchAppConfig({ connectionTableColumns: newSelectedColumns })
  }

  return (
    <Modal
      backdrop="blur"
      classNames={{ backdrop: 'top-[48px]' }}
      size="lg"
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
      hideCloseButton
    >
      <ModalContent>
        <ModalHeader className="flex justify-between items-center px-6 py-4 pr-4">
          <span className="text-lg font-semibold">连接设置</span>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={onClose}
          >
            <IoClose className="text-lg" />
          </Button>
        </ModalHeader>
        <ModalBody className="px-6 py-4 gap-4 pb-6">
          <div className="space-y-3">
            <SettingItem title="显示应用图标">
              <Switch
                size="sm"
                isSelected={displayIcon}
                onValueChange={(v) => {
                  patchAppConfig({ displayIcon: v })
                }}
              />
            </SettingItem>
            <SettingItem title="显示应用名称">
              <Switch
                size="sm"
                isSelected={displayAppName}
                onValueChange={(v) => {
                  patchAppConfig({ displayAppName: v })
                }}
              />
            </SettingItem>
            <SettingItem
              title={
                <>
                  刷新间隔
                  <span className="text-xs text-foreground-400 font-normal ml-1">
                    (ms)
                  </span>
                </>
              }
            >
              <Input
                size="sm"
                className="w-[120px]"
                classNames={secondaryInputClassNames}
                value={interval}
                placeholder="默认 500"
                onValueChange={(v) => {
                  // 允许空值以便用户删除
                  if (v === '') {
                    setInterval('')
                    return
                  }
                  // 只允许输入数字
                  if (!/^\d*$/.test(v)) return
                  
                  setInterval(v)
                  updateInterval(v)
                }}
              />
            </SettingItem>
          </div>
          
          <Divider />
          
          <div>
            <div className="text-sm font-medium mb-3">自定义表格列</div>
            <div className="text-xs text-foreground-400 mb-3">拖拽调整顺序，点击切换显示</div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={sortedColumns} strategy={rectSortingStrategy}>
                <div className="flex flex-wrap gap-2">
                  {sortedColumns.map(key => {
                    const col = ALL_COLUMNS.find(c => c.key === key)
                    if (!col) return null
                    return (
                      <SortableChip
                        key={col.key}
                        id={col.key}
                        label={col.label}
                        isSelected={connectionTableColumns.includes(col.key)}
                        onToggle={() => toggleColumn(col.key)}
                      />
                    )
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default ConnectionSettingModal
