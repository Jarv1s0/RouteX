import React, { memo, useCallback, useMemo } from 'react'
import { HiSortAscending, HiSortDescending } from 'react-icons/hi'
import { Virtuoso } from 'react-virtuoso'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { useI18n } from '@renderer/i18n'
import { useLatest } from '@renderer/hooks/use-latest'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { DEFAULT_COLUMNS } from './connection-setting-modal'

import { DEFAULT_COLUMN_WIDTHS, COLUMN_LABEL_KEYS, RIGHT_ALIGN_COLUMNS } from './columns'
import { useColumnResize } from './hooks/use-column-resize'
import { ConnectionRow } from './connection-row'

// 列宽调整手柄
const ResizeHandle: React.FC<{
  onResize: (delta: number) => void
  onResizeEnd: () => void
}> = ({ onResize, onResizeEnd }) => {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    let startX = e.clientX

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX
      startX = e.clientX
      onResize(delta)
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      onResizeEnd()
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <div
      className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
      onMouseDown={handleMouseDown}
    />
  )
}

interface Props {
  connections: ControllerConnectionDetail[]
  selected: ControllerConnectionDetail | undefined
  setSelected: React.Dispatch<React.SetStateAction<ControllerConnectionDetail | undefined>>
  setIsDetailModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  close: (id: string) => void
  iconMap: Record<string, string>
  appNameCache: Record<string, string>
  displayIcon: boolean
  displayAppName: boolean
  sortBy?: string
  sortDirection?: 'asc' | 'desc'
  onSort?: (column: string) => void
  onContextMenu?: (conn: ControllerConnectionDetail, event: React.MouseEvent) => void
  onVisibleRangeChange?: (range: { startIndex: number; endIndex: number }) => void
  hiddenRules?: Set<string>
}

const ConnectionTableComponent: React.FC<Props> = ({
  connections,
  selected,
  setSelected,
  setIsDetailModalOpen,
  close,
  iconMap,
  appNameCache,
  displayIcon,
  displayAppName,
  sortBy,
  sortDirection,
  onSort,
  onContextMenu,
  onVisibleRangeChange,
  hiddenRules
}) => {
  const { t, locale } = useI18n()
  const { appConfig } = useAppConfig()
  const { connectionTableColumns = DEFAULT_COLUMNS } = appConfig || {}

  const { computedWidths, handleResize, saveColumnWidths } = useColumnResize()

  // 过滤有效的列
  const visibleColumns = useMemo(() => {
    return connectionTableColumns.filter((col) => COLUMN_LABEL_KEYS[col])
  }, [connectionTableColumns])

  const handleRowClick = useCallback(
    (conn: ControllerConnectionDetail) => {
      setSelected(conn)
      setIsDetailModalOpen(true)
    },
    [setSelected, setIsDetailModalOpen]
  )

  const handleClose = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation()
      close(id)
    },
    [close]
  )

  // 使用 useLatest 包装不影响组件结构的上下文依赖
  const latestContext = useLatest({
    handleRowClick,
    handleClose,
    visibleColumns,
    computedWidths,
    iconMap,
    appNameCache,
    displayIcon,
    displayAppName,
    onContextMenu,
    hiddenRules,
    t,
    locale
  })

  // 渲染单行的回调
  const renderRow = useCallback(
    (_index: number, conn: ControllerConnectionDetail, context: { selectedId?: string }) => {
      const p = latestContext.current
      return (
        <ConnectionRow
          key={conn.id}
          conn={conn}
          isSelected={context.selectedId === conn.id}
          onRowClick={p.handleRowClick}
          onClose={p.handleClose}
          visibleColumns={p.visibleColumns}
          columnWidths={p.computedWidths}
          iconMap={p.iconMap}
          appNameCache={p.appNameCache}
          displayIcon={p.displayIcon}
          displayAppName={p.displayAppName}
          onContextMenu={p.onContextMenu}
          hiddenRules={p.hiddenRules}
          t={p.t}
          locale={p.locale}
        />
      )
    },
    [latestContext]
  )

  return (
    <div className="w-full h-full flex flex-col">
      {/* 表头 */}
      <div className={CARD_STYLES.GLASS_TABLE_HEADER}>
        <div className="flex w-full">
          {visibleColumns.map((col, index) => (
            <div
              key={col}
              className={`relative flex-shrink-0 px-3 py-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer select-none ${RIGHT_ALIGN_COLUMNS.includes(col) ? 'justify-end' : ''}`}
              style={{ width: computedWidths[col] || DEFAULT_COLUMN_WIDTHS[col] }}
              onClick={() => onSort?.(col)}
            >
              <div
                className={`flex items-center gap-1 ${RIGHT_ALIGN_COLUMNS.includes(col) ? 'justify-end' : ''}`}
              >
                <span>{t(COLUMN_LABEL_KEYS[col])}</span>
                {sortBy === col &&
                  (sortDirection === 'asc' ? (
                    <HiSortAscending className="text-primary" />
                  ) : (
                    <HiSortDescending className="text-primary" />
                  ))}
              </div>
              {index < visibleColumns.length - 1 && (
                <ResizeHandle
                  onResize={(delta) => handleResize(col, delta)}
                  onResizeEnd={saveColumnWidths}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 表体 - 使用虚拟滚动 */}
      <div className="flex-1">
        <Virtuoso
          data={connections}
          itemContent={renderRow}
          context={{ selectedId: selected?.id }}
          overscan={10}
          rangeChanged={onVisibleRangeChange}
        />
      </div>
    </div>
  )
}

const ConnectionTable = memo(ConnectionTableComponent)

export default ConnectionTable
