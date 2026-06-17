import React, { memo, useMemo, useCallback } from 'react'
import { Button } from '@heroui/react'
import { CgClose, CgTrash } from 'react-icons/cg'
import { TranslationKey } from '@renderer/i18n'
import MihomoIcon from '@renderer/components/base/mihomo-icon'
import { isMihomoProcessPath } from '@renderer/utils/mihomo-process'
import { calcTraffic } from '@renderer/utils/calc'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { getConnectionHideRule } from './shared'
import { DEFAULT_COLUMN_WIDTHS, RIGHT_ALIGN_COLUMNS } from './columns'
import {
  getConnectionStartTime,
  getConnectionChainDisplay,
  formatDurationFromStartMs,
  getConnectionHost,
  getConnectionType,
  getConnectionRule,
  getConnectionRowRenderKey
} from './connection-row-utils'

export interface RowProps {
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
  hiddenRules?: Set<string>
  t: (key: TranslationKey, values?: Record<string, string | number>) => string
  locale: string
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
  onContextMenu,
  hiddenRules,
  t
}) => {
  const isHidden = useMemo(() => {
    if (!hiddenRules) return false
    return hiddenRules.has(getConnectionHideRule(conn))
  }, [hiddenRules, conn])

  const processPath = conn.metadata.processPath || ''
  const iconUrl = displayIcon ? iconMap[processPath] || '' : ''
  const appName = displayAppName && processPath ? appNameCache[processPath] : undefined
  const processName =
    appName || conn.metadata.process?.replace(/\.exe$/, '') || conn.metadata.sourceIP || '-'
  const useMihomoIcon =
    displayIcon &&
    (isMihomoProcessPath(conn.metadata.processPath) || isMihomoProcessPath(conn.metadata.process))

  const getColumnValue = (col: string): string => {
    switch (col) {
      case 'host':
        return getConnectionHost(conn)
      case 'process':
        return processName
      case 'type':
        return getConnectionType(conn)
      case 'rule':
        return getConnectionRule(conn)
      case 'chains':
        return getConnectionChainDisplay(conn)
      case 'downloadSpeed':
        return conn.downloadSpeed ? `${calcTraffic(conn.downloadSpeed)}/s` : '0 B/s'
      case 'uploadSpeed':
        return conn.uploadSpeed ? `${calcTraffic(conn.uploadSpeed)}/s` : '0 B/s'
      case 'download':
        return calcTraffic(conn.download)
      case 'upload':
        return calcTraffic(conn.upload)
      case 'time':
        return formatDurationFromStartMs(getConnectionStartTime(conn), t)
      case 'sourceIP':
        return conn.metadata.sourceIP || '-'
      case 'sourcePort':
        return conn.metadata.sourcePort || '-'
      case 'destinationIP':
        return conn.metadata.destinationIP || '-'
      case 'sniffHost':
        return conn.metadata.sniffHost || '-'
      case 'inboundName':
        return conn.metadata.inboundName || '-'
      case 'inboundUser':
        return conn.metadata.inboundUser || '-'
      default:
        return '-'
    }
  }

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
        <div className="flex items-center gap-3 truncate">
          {displayIcon &&
            (useMihomoIcon ? (
              <MihomoIcon className="w-6 h-6 flex-shrink-0 text-default-500" />
            ) : (
              <img src={iconUrl} className="w-6 h-6 flex-shrink-0 object-contain" alt="" />
            ))}
          <span className="truncate flex items-center gap-1.5" title={processName}>
            {processName}
            {isHidden && (
              <span className="text-default-400 opacity-50" title={t('connections.hiddenTitle')}>
                <svg
                  stroke="currentColor"
                  fill="currentColor"
                  strokeWidth="0"
                  viewBox="0 0 512 512"
                  height="12px"
                  width="12px"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M256 128a113.84 113.84 0 00-111.94 90.11c-.13.52-.25 1.05-.36 1.58a112.51 112.51 0 001.32 50 114.7 114.7 0 0013.9 33.68l42.6-42.6A63.85 63.85 0 01192 256v-.06a64 64 0 01103.11-51.11L332 168.06A113.59 113.59 0 00256 128zM315.65 244.35l42.6-42.6a113.62 113.62 0 0116.07 101.44 115.35 115.35 0 01-11.95 24.31l-42.6-42.6a64.31 64.31 0 00-4.12-40.55zm-143.24 64h.14L114.61 366.3a256.78 256.78 0 01-38.62-31.54C34.72 297.43 16 256 16 256s18.72-41.43 51.3-71.8a257.65 257.65 0 0153.11-37.58l45 45a64 64 0 007 86.73zM512 256s-18.72 41.43-51.3 71.8a257.65 257.65 0 01-53.11 37.58L362.59 320.4a64.09 64.09 0 00-7-86.73h-.14l57.94-57.94a256.78 256.78 0 0138.62 31.54C477.28 214.57 496 256 496 256s-18.73 41.43-51.31 71.8a256.88 256.88 0 01-32.9 26.65l38.42 38.42a420.9 420.9 0 0041.52-38C496 323.23 512 284 512 256zM80 64l368 384"></path>
                </svg>
              </span>
            )}
          </span>
        </div>
      )
    }

    if (col === 'chains') {
      const chains = getColumnValue('chains')
      return (
        <div className="flex items-center truncate" title={chains}>
          <span className={conn.chains && conn.chains[0] === 'DIRECT' ? '' : 'text-primary'}>
            {chains}
          </span>
        </div>
      )
    }

    if (col === 'downloadSpeed') {
      const downloadSpeed = getColumnValue('downloadSpeed')
      return (
        <div
          className={`flex items-center justify-end font-data-numeric ${conn.downloadSpeed ? 'text-purple-500' : 'text-foreground-500'}`}
        >
          {downloadSpeed}
        </div>
      )
    }

    if (col === 'uploadSpeed') {
      const uploadSpeed = getColumnValue('uploadSpeed')
      return (
        <div
          className={`flex items-center justify-end font-data-numeric ${conn.uploadSpeed ? 'text-cyan-500' : 'text-foreground-500'}`}
        >
          {uploadSpeed}
        </div>
      )
    }

    const isRightAlign = RIGHT_ALIGN_COLUMNS.includes(col)
    const color = ['time'].includes(col) ? 'text-foreground-500' : ''
    const isMono = [
      'sourceIP',
      'sourcePort',
      'destinationIP',
      'sniffHost',
      'download',
      'upload'
    ].includes(col)
    const isDataNumeric = ['download', 'upload'].includes(col)

    const value = getColumnValue(col)

    return (
      <div
        className={`flex items-center truncate ${isRightAlign ? 'justify-end' : ''} ${color} ${isMono && !isDataNumeric ? 'font-mono' : ''} ${isDataNumeric ? 'font-data-numeric' : ''}`}
        title={value}
      >
        {value}
      </div>
    )
  }

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      onContextMenu?.(conn, e)
    },
    [onContextMenu, conn]
  )

  return (
    <div
      className={CARD_STYLES.GLASS_TABLE_ROW}
      data-selected={isSelected}
      onClick={() => onRowClick(conn)}
      onContextMenu={handleContextMenu}
    >
      {visibleColumns.map((col) => (
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

export const ConnectionRow = memo(ConnectionRowComponent, (prev, next) => {
  return (
    prev.conn.id === next.conn.id &&
    prev.conn.upload === next.conn.upload &&
    prev.conn.download === next.conn.download &&
    prev.conn.uploadSpeed === next.conn.uploadSpeed &&
    prev.conn.downloadSpeed === next.conn.downloadSpeed &&
    prev.conn.isActive === next.conn.isActive &&
    getConnectionRowRenderKey(prev.conn) === getConnectionRowRenderKey(next.conn) &&
    prev.isSelected === next.isSelected &&
    prev.columnWidths === next.columnWidths &&
    prev.iconMap === next.iconMap &&
    prev.appNameCache === next.appNameCache &&
    prev.displayIcon === next.displayIcon &&
    prev.displayAppName === next.displayAppName &&
    prev.hiddenRules === next.hiddenRules &&
    prev.locale === next.locale
  )
})
