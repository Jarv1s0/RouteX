import React, { memo, useCallback, useMemo, useState, useRef, useEffect } from 'react'
import { Avatar, Button } from '@heroui/react'

import { calcTraffic } from '@renderer/utils/calc'
import dayjs from 'dayjs'
import { CgClose, CgTrash } from 'react-icons/cg'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { DEFAULT_COLUMNS } from './connection-setting-modal'
import { HiSortAscending, HiSortDescending } from 'react-icons/hi'
import { Virtuoso } from 'react-virtuoso'
import { CARD_STYLES } from '@renderer/utils/card-styles'


// 列配置 - 默认宽度
const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  close: 40,
  host: 200,
  process: 150,
  type: 100,
  rule: 150,
  chains: 200,
  downloadSpeed: 120,
  uploadSpeed: 120,
  download: 80,
  upload: 80,
  time: 90,
  sourceIP: 120,
  sourcePort: 80,
  destinationIP: 120,
  sniffHost: 150,
  inboundName: 100,
  inboundUser: 100
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
}

// ... (existing code)

// 列标签
const COLUMN_LABELS: Record<string, string> = {
  close: '关闭',
  host: '主机',
  process: '进程',
  type: '类型',
  rule: '规则',
  chains: '代理链',
  downloadSpeed: '↓速度',
  uploadSpeed: '↑速度',
  download: '下载',
  upload: '上传',
  time: '时间',
  sourceIP: '源IP',
  sourcePort: '源端口',
  destinationIP: '目标IP',
  sniffHost: '嗅探主机',
  inboundName: '入站名称',
  inboundUser: '入站用户'
}

// 右对齐的列
const RIGHT_ALIGN_COLUMNS = ['downloadSpeed', 'uploadSpeed', 'download', 'upload', 'time']

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
  onContextMenu
}) => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const { 
    connectionTableColumns = DEFAULT_COLUMNS,
    connectionTableColumnWidths = {}
  } = appConfig || {}

  // 合并默认宽度和用户自定义宽度
  const columnWidths = useMemo(() => ({
    ...DEFAULT_COLUMN_WIDTHS,
    ...connectionTableColumnWidths
  }), [connectionTableColumnWidths])

  // 本地状态用于实时更新
  const [localWidths, setLocalWidths] = useState(columnWidths)
  
  // 使用 ref 保存最新的 localWidths，解决闭包问题
  const localWidthsRef = useRef(localWidths)
  localWidthsRef.current = localWidths

  // 同步配置变化
  useEffect(() => {
    setLocalWidths(prev => {
      const next = { ...DEFAULT_COLUMN_WIDTHS, ...connectionTableColumnWidths }
      if (JSON.stringify(prev) === JSON.stringify(next)) {
        return prev
      }
      return next
    })
  }, [connectionTableColumnWidths])

  // 过滤有效的列
  const visibleColumns = useMemo(() => {
    return connectionTableColumns.filter(col => COLUMN_LABELS[col])
  }, [connectionTableColumns])

  // 直接使用本地列宽，不进行自动布局计算，避免 resizing 时的联动
  const computedWidths = localWidths

  const handleRowClick = useCallback((conn: ControllerConnectionDetail) => {
    setSelected(conn)
    setIsDetailModalOpen(true)
  }, [setSelected, setIsDetailModalOpen])

  const handleClose = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    close(id)
  }, [close])

  // 处理列宽调整
  const handleResize = useCallback((col: string, delta: number) => {
    setLocalWidths(prev => {
      const newWidth = Math.max(40, (prev[col] || DEFAULT_COLUMN_WIDTHS[col]) + delta)
      return { ...prev, [col]: newWidth }
    })
  }, [])

  // 保存列宽（鼠标释放时）
  const saveColumnWidths = useCallback(() => {
    const currentWidths = localWidthsRef.current
    // 保存所有与默认值不同的列宽
    const changedWidths: Record<string, number> = {}
    for (const col of Object.keys(currentWidths)) {
      if (currentWidths[col] !== DEFAULT_COLUMN_WIDTHS[col]) {
        changedWidths[col] = Math.round(currentWidths[col])
      }
    }
    // 也保留之前已保存但这次没改的列宽
    for (const col of Object.keys(connectionTableColumnWidths)) {
      if (!(col in changedWidths) && connectionTableColumnWidths[col] !== DEFAULT_COLUMN_WIDTHS[col]) {
        changedWidths[col] = connectionTableColumnWidths[col]
      }
    }
    patchAppConfig({ connectionTableColumnWidths: changedWidths })
  }, [connectionTableColumnWidths, patchAppConfig])

  // 渲染单行的回调
  const renderRow = useCallback((_index: number, conn: ControllerConnectionDetail) => (
    <ConnectionRow
      key={conn.id}
      conn={conn}
      isSelected={selected?.id === conn.id}
      onRowClick={handleRowClick}
      onClose={handleClose}
      visibleColumns={visibleColumns}
      columnWidths={computedWidths}
      iconMap={iconMap}
      appNameCache={appNameCache}
      displayIcon={displayIcon}
      displayAppName={displayAppName}
      onContextMenu={onContextMenu}
    />
  ), [selected, handleRowClick, handleClose, visibleColumns, computedWidths, iconMap, appNameCache, displayIcon, displayAppName, onContextMenu])

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
              <div className={`flex items-center gap-1 ${RIGHT_ALIGN_COLUMNS.includes(col) ? 'justify-end' : ''}`}>
                <span>{COLUMN_LABELS[col]}</span>
                {sortBy === col && (
                  sortDirection === 'asc' 
                    ? <HiSortAscending className="text-primary" />
                    : <HiSortDescending className="text-primary" />
                )}
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
          overscan={10}
        />
      </div>
    </div>
  )
}

// 单行组件
interface RowProps {
  conn: ControllerConnectionDetail
  isSelected: boolean
  onRowClick: (conn: ControllerConnectionDetail) => void
  onClose: (e: React.MouseEvent, id: string) => void
  visibleColumns: string[]
  columnWidths: Record<string, number>
  iconMap: Record<string, string>
  appNameCache: Record<string, string>
  displayIcon: boolean
  displayAppName: boolean
  onContextMenu?: (conn: ControllerConnectionDetail, event: React.MouseEvent) => void
}

const ConnectionRowComponent: React.FC<RowProps> = ({
  conn,
  isSelected,
  onRowClick,
  onClose,
  visibleColumns,
  columnWidths,
  iconMap,
  appNameCache,
  displayIcon,
  displayAppName,
  onContextMenu
}) => {
  const processPath = conn.metadata.processPath || ''
  const iconUrl = displayIcon ? iconMap[processPath] || '' : ''
  const appName = displayAppName && processPath ? appNameCache[processPath] : undefined
  const processName = appName || conn.metadata.process?.replace(/\.exe$/, '') || conn.metadata.sourceIP || '-'

  // 获取代理链显示
  const getChainDisplay = (chains: string[]): string => {
    if (!chains || chains.length === 0) return 'DIRECT'
    return chains.slice().reverse().join(' → ')
  }

  // 格式化时间
  const formatDuration = (start: string): string => {
    const seconds = dayjs().diff(dayjs(start), 'second')
    if (seconds < 60) return `${seconds}秒前`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}分钟前`
    const hours = Math.floor(minutes / 60)
    return `${hours}小时前`
  }

  // 预计算所有可能的列值
  const columnValues = useMemo(() => ({
    host: conn.metadata.host || conn.metadata.sniffHost || conn.metadata.destinationIP || conn.metadata.remoteDestination || '-',
    process: processName,
    type: `${conn.metadata.type} | ${conn.metadata.network}`,
    rule: conn.rulePayload ? `${conn.rule}: ${conn.rulePayload}` : (conn.rule || '-'),
    chains: getChainDisplay(conn.chains),
    downloadSpeed: conn.downloadSpeed ? `${calcTraffic(conn.downloadSpeed)}/s` : '0 B/s',
    uploadSpeed: conn.uploadSpeed ? `${calcTraffic(conn.uploadSpeed)}/s` : '0 B/s',
    download: calcTraffic(conn.download),
    upload: calcTraffic(conn.upload),
    time: formatDuration(conn.start),
    sourceIP: conn.metadata.sourceIP || '-',
    sourcePort: conn.metadata.sourcePort || '-',
    destinationIP: conn.metadata.destinationIP || '-',
    sniffHost: conn.metadata.sniffHost || '-',
    inboundName: conn.metadata.inboundName || '-',
    inboundUser: conn.metadata.inboundUser || '-'
  }), [conn, processName])

  const renderCell = (col: string) => {
    if (col === 'close') {
      return (
        <div className="flex items-center">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            className="w-6 h-6 min-w-6"
            onPress={(e) => onClose(e as unknown as React.MouseEvent, conn.id)}
          >
            {conn.isActive ? (
              <CgClose className="text-warning" />
            ) : (
              <CgTrash className="text-danger" />
            )}
          </Button>
        </div>
      )
    }

    if (col === 'process') {
      return (
        <div className="flex items-center gap-2 truncate">
          {displayIcon && (
            <Avatar
              size="sm"
              radius="sm"
              src={iconUrl}
              className="bg-transparent w-6 h-6 min-w-6 flex-shrink-0"
            />
          )}
          <span className="truncate" title={processName}>{processName}</span>
        </div>
      )
    }

    if (col === 'chains') {
      return (
        <div className="flex items-center truncate" title={columnValues.chains}>
          <span className={conn.chains[0] === 'DIRECT' ? '' : 'text-primary'}>
            {columnValues.chains}
          </span>
        </div>
      )
    }

    if (col === 'downloadSpeed') {
      return (
        <div className={`flex items-center justify-end font-mono ${conn.downloadSpeed ? 'text-purple-500' : 'text-foreground-500'}`}>
          {columnValues.downloadSpeed}
        </div>
      )
    }

    if (col === 'uploadSpeed') {
      return (
        <div className={`flex items-center justify-end font-mono ${conn.uploadSpeed ? 'text-cyan-500' : 'text-foreground-500'}`}>
          {columnValues.uploadSpeed}
        </div>
      )
    }

    const isRightAlign = RIGHT_ALIGN_COLUMNS.includes(col)
    const color = ['time'].includes(col) ? 'text-foreground-500' : ''
    const isMono = ['sourceIP', 'sourcePort', 'destinationIP', 'sniffHost', 'download', 'upload'].includes(col)

    return (
      <div className={`flex items-center truncate ${isRightAlign ? 'justify-end' : ''} ${color} ${isMono ? 'font-mono' : ''}`} title={columnValues[col as keyof typeof columnValues]}>
        {columnValues[col as keyof typeof columnValues]}
      </div>
    )
  }

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    onContextMenu?.(conn, e)
  }, [onContextMenu, conn])

  return (
    <div
      className={CARD_STYLES.GLASS_TABLE_ROW}
      data-selected={isSelected}
      onClick={() => onRowClick(conn)}
      onContextMenu={handleContextMenu}
    >
      {visibleColumns.map(col => (
        <div
          key={col}
          className="flex-shrink-0 px-3 py-2.5 text-sm"
          style={{ width: columnWidths[col] || DEFAULT_COLUMN_WIDTHS[col] }}
        >
          {renderCell(col)}
        </div>
      ))}
    </div>
  )
}

const ConnectionRow = memo(ConnectionRowComponent, (prev, next) => {
  return (
    prev.conn.id === next.conn.id &&
    prev.conn.upload === next.conn.upload &&
    prev.conn.download === next.conn.download &&
    prev.conn.uploadSpeed === next.conn.uploadSpeed &&
    prev.conn.downloadSpeed === next.conn.downloadSpeed &&
    prev.conn.isActive === next.conn.isActive &&
    prev.isSelected === next.isSelected &&
    prev.columnWidths === next.columnWidths &&
    prev.iconMap === next.iconMap &&
    prev.appNameCache === next.appNameCache &&
    prev.displayIcon === next.displayIcon &&
    prev.displayAppName === next.displayAppName
  )
})

const ConnectionTable = memo(ConnectionTableComponent)

export default ConnectionTable
