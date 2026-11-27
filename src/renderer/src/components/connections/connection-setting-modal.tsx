import { notifyError } from '@renderer/utils/notify'
import { Modal, ModalContent, ModalHeader, ModalBody, Input, Button, Chip } from '@heroui/react'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useQueuedSettingSave } from '@renderer/hooks/use-queued-setting-save'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { restartMihomoConnections } from '@renderer/utils/mihomo-ipc'
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
import { MdDragIndicator, MdRefresh } from 'react-icons/md'
import SecondaryModalCloseButton from '@renderer/components/base/secondary-modal-close'
import {
  createSecondaryModalClassNames,
  getMainPaneModalContentStyle
} from '@renderer/utils/modal-styles'
import { useI18n, type TranslationKey } from '@renderer/i18n'
import AppSwitch from '@renderer/components/base/app-switch'
import { useConnectionTable } from '@renderer/hooks/use-connection-table'
import { DEFAULT_COLUMNS } from '@renderer/components/connections/columns'
import {
  MODAL_SECTION_NUMBER_INPUT_CLASSNAMES,
  MODAL_SETTING_BODY_CLASSNAME,
  MODAL_SETTING_HEADER_CLASSNAME,
  MODAL_SETTING_MODAL_OVERRIDES,
  ModalSettingRow,
  ModalSettingSection
} from '@renderer/components/base/modal-setting-section'

const MIN_CONNECTION_INTERVAL = 500
const NO_CONNECTIONS: ControllerConnectionDetail[] = []

// 所有可用的表格列
const ALL_COLUMNS = [
  { key: 'close', labelKey: 'connections.column.close' },
  { key: 'host', labelKey: 'connections.column.host' },
  { key: 'process', labelKey: 'connections.column.process' },
  { key: 'type', labelKey: 'connections.column.type' },
  { key: 'rule', labelKey: 'connections.column.rule' },
  { key: 'chains', labelKey: 'connections.column.chains' },
  { key: 'downloadSpeed', labelKey: 'connections.column.downloadSpeed' },
  { key: 'uploadSpeed', labelKey: 'connections.column.uploadSpeed' },
  { key: 'download', labelKey: 'connections.column.download' },
  { key: 'upload', labelKey: 'connections.column.upload' },
  { key: 'time', labelKey: 'connections.column.time' },
  { key: 'sourceIP', labelKey: 'connections.column.sourceIP' },
  { key: 'sourcePort', labelKey: 'connections.column.sourcePort' },
  { key: 'destinationIP', labelKey: 'connections.column.destinationIP' },
  { key: 'sniffHost', labelKey: 'connections.column.sniffHost' },
  { key: 'inboundName', labelKey: 'connections.column.inboundName' },
  { key: 'inboundUser', labelKey: 'connections.column.inboundUser' }
]

function normalizeConnectionInterval(value?: number): number {
  if (!value || !Number.isFinite(value)) return MIN_CONNECTION_INTERVAL
  return Math.max(MIN_CONNECTION_INTERVAL, Math.round(value))
}

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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    zIndex: isDragging ? 1000 : undefined
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} aria-pressed={isSelected}>
      <Chip
        variant="flat"
        radius="full"
        size="sm"
        className={`cursor-grab active:cursor-grabbing select-none border transition-colors ${
          isSelected
            ? 'border-primary/30 bg-primary/14 text-primary hover:bg-primary/20 dark:border-primary/40 dark:bg-primary/20'
            : 'border-default-200/85 bg-default-100/85 text-foreground/75 hover:bg-default-200/75 hover:text-foreground dark:border-white/12 dark:bg-white/[0.06] dark:hover:bg-white/[0.12]'
        }`}
        classNames={{
          content: 'flex items-center gap-1 px-0.5 text-xs font-medium'
        }}
        startContent={<MdDragIndicator className="text-sm opacity-60" />}
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
  const { t } = useI18n()
  const { appConfig, patchAppConfig } = useAppConfig()

  const {
    collapseSidebar = false,
    siderWidth = 220,
    displayIcon = true,
    displayAppName = true,
    connectionInterval: rawConnectionInterval = MIN_CONNECTION_INTERVAL,
    connectionTableColumns
  } = appConfig || {}

  const connectionInterval = normalizeConnectionInterval(rawConnectionInterval)
  const table = useConnectionTable(NO_CONNECTIONS)

  const [intervalInput, setIntervalInput] = useState(connectionInterval.toString())
  const [saveInterval, isSavingInterval] = useQueuedSettingSave(connectionInterval)

  useEffect(() => {
    if (!isSavingInterval()) setIntervalInput(connectionInterval.toString())
  }, [connectionInterval, isSavingInterval])

  const commitInterval = useCallback(
    (raw = intervalInput) => {
      const parsed = Number.parseInt(raw, 10)
      const next = Number.isFinite(parsed)
        ? Math.max(MIN_CONNECTION_INTERVAL, parsed)
        : MIN_CONNECTION_INTERVAL
      setIntervalInput(next.toString())
      saveInterval(next, async (value) => {
        await patchAppConfig({ connectionInterval: value })
        await restartMihomoConnections()
      })
    },
    [intervalInput, patchAppConfig, saveInterval]
  )

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
  const sortedColumns = useMemo(() => {
    const selected = table.getVisibleLeafColumns().map((column) => column.id)
    return [
      ...selected,
      ...ALL_COLUMNS.filter((column) => !selected.includes(column.key)).map((column) => column.key)
    ]
  }, [table, table.state.columnOrder, table.state.columnVisibility, table.state.columnPinning])

  const isDefaultColumns =
    !connectionTableColumns ||
    (connectionTableColumns.length === DEFAULT_COLUMNS.length &&
      connectionTableColumns.every((col, index) => col === DEFAULT_COLUMNS[index]))

  const toggleColumn = (key: string): void => {
    table.getColumn(key)?.toggleVisibility()
  }

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sortedColumns.indexOf(active.id as string)
    const newIndex = sortedColumns.indexOf(over.id as string)
    const newOrder = arrayMove(sortedColumns, oldIndex, newIndex)

    table.setColumnOrder(newOrder)
  }

  return (
    <Modal
      backdrop="blur"
      classNames={createSecondaryModalClassNames(MODAL_SETTING_MODAL_OVERRIDES)}
      size="lg"
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
      hideCloseButton
    >
      <ModalContent
        style={getMainPaneModalContentStyle({ collapseSidebar, siderWidth, maxWidthPx: 740 })}
      >
        <ModalHeader className={MODAL_SETTING_HEADER_CLASSNAME}>
          <span>{t('page.connections.settings')}</span>
          <SecondaryModalCloseButton onPress={onClose} />
        </ModalHeader>
        <ModalBody className={MODAL_SETTING_BODY_CLASSNAME}>
          <ModalSettingSection title={t('connections.section.general')}>
            <ModalSettingRow title={t('connections.showAppIcon')}>
              <AppSwitch
                size="sm"
                aria-label={t('connections.showAppIcon')}
                isSelected={displayIcon}
                onValueChange={(v) => {
                  patchAppConfig({ displayIcon: v }).catch((error) => notifyError(error))
                }}
              />
            </ModalSettingRow>

            <ModalSettingRow title={t('connections.showAppName')}>
              <AppSwitch
                size="sm"
                aria-label={t('connections.showAppName')}
                isSelected={displayAppName}
                onValueChange={(v) => {
                  patchAppConfig({ displayAppName: v }).catch((error) => notifyError(error))
                }}
              />
            </ModalSettingRow>

            <ModalSettingRow
              title={t('connections.refreshInterval')}
              hint={t('connections.refreshIntervalHelp')}
            >
              <Input
                type="number"
                size="sm"
                aria-label={t('connections.refreshInterval')}
                className="w-full sm:w-[136px]"
                classNames={MODAL_SECTION_NUMBER_INPUT_CLASSNAMES}
                min={MIN_CONNECTION_INTERVAL}
                value={intervalInput}
                placeholder={t('connections.defaultInterval', { value: MIN_CONNECTION_INTERVAL })}
                endContent={<span className="select-none text-xs text-foreground/60">ms</span>}
                onValueChange={setIntervalInput}
                onBlur={() => {
                  void commitInterval()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void commitInterval()
                  }
                }}
              />
            </ModalSettingRow>
          </ModalSettingSection>

          <ModalSettingSection title={t('connections.customColumns')}>
            <div className="px-3.5 py-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-foreground/70">
                  {t('connections.customColumnsHelp')}
                </span>
                <Button
                  size="sm"
                  variant="flat"
                  radius="full"
                  isDisabled={isDefaultColumns}
                  startContent={<MdRefresh className="text-base" />}
                  onPress={() => {
                    patchAppConfig({ connectionTableColumns: DEFAULT_COLUMNS }).catch((error) =>
                      notifyError(error)
                    )
                  }}
                >
                  {t('common.reset')}
                </Button>
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={sortedColumns} strategy={rectSortingStrategy}>
                  <div className="flex flex-wrap gap-2">
                    {sortedColumns.map((key) => {
                      const col = ALL_COLUMNS.find((c) => c.key === key)
                      if (!col) return null
                      return (
                        <SortableChip
                          key={col.key}
                          id={col.key}
                          label={t(col.labelKey as TranslationKey)}
                          isSelected={table.getColumn(col.key)?.getIsVisible() ?? false}
                          onToggle={() => toggleColumn(col.key)}
                        />
                      )
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </ModalSettingSection>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default ConnectionSettingModal
