import ConnectionItem from '@renderer/components/connections/connection-item'
import ConnectionTable from '@renderer/components/connections/connection-table'
import EmptyState from '@renderer/components/base/empty-state'
import { Virtuoso } from 'react-virtuoso'
import React, { useCallback } from 'react'
import { IoLink } from 'react-icons/io5'
import { getConnectionHideRule, type ConnectionOrderBy, type ConnectionTab, type ConnectionViewMode, type VisibleRange } from '@renderer/components/connections/shared'

interface ConnectionsContentProps {
  tab: ConnectionTab
  viewMode: ConnectionViewMode
  filteredConnections: ControllerConnectionDetail[]
  selected?: ControllerConnectionDetail
  displayIcon: boolean
  displayAppName: boolean
  findProcessMode: string
  iconMap: Record<string, string>
  appNameCache: Record<string, string>
  hiddenRules: Set<string>
  timeRefreshTrigger: number
  firstItemRefreshTrigger: number
  connectionOrderBy: ConnectionOrderBy
  connectionDirection: 'asc' | 'desc'
  setSelected: React.Dispatch<React.SetStateAction<ControllerConnectionDetail | undefined>>
  setIsDetailModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  closeConnection: (id: string) => void
  hideConnection: (id: string) => void
  unhideConnection: (id: string) => void
  handleContextMenu: (conn: ControllerConnectionDetail, e: React.MouseEvent) => void
  handleVisibleRangeChange: (range: VisibleRange) => void
  handleTableSort: (column: string) => void
}

export default function ConnectionsContent({
  tab,
  viewMode,
  filteredConnections,
  selected,
  displayIcon,
  displayAppName,
  findProcessMode,
  iconMap,
  appNameCache,
  hiddenRules,
  timeRefreshTrigger,
  firstItemRefreshTrigger,
  connectionOrderBy,
  connectionDirection,
  setSelected,
  setIsDetailModalOpen,
  closeConnection,
  hideConnection,
  unhideConnection,
  handleContextMenu,
  handleVisibleRangeChange,
  handleTableSort
}: ConnectionsContentProps): React.ReactNode {
  const renderConnectionItem = useCallback(
    (index: number, connection: ControllerConnectionDetail) => {
      const processPath = connection.metadata.processPath || ''
      const iconUrl = (displayIcon && findProcessMode !== 'off' && iconMap[processPath]) || ''
      const itemKey = index === 0 ? `${connection.id}-${firstItemRefreshTrigger}` : connection.id
      const displayName =
        displayAppName && connection.metadata.processPath
          ? appNameCache[connection.metadata.processPath]
          : undefined

      return (
        <ConnectionItem
          setSelected={setSelected}
          setIsDetailModalOpen={setIsDetailModalOpen}
          selectedId={selected?.id}
          iconUrl={iconUrl}
          displayIcon={displayIcon && findProcessMode !== 'off'}
          displayName={displayName}
          close={closeConnection}
          hide={hideConnection}
          unhide={unhideConnection}
          isHidden={hiddenRules.has(getConnectionHideRule(connection))}
          index={index}
          key={itemKey}
          info={connection}
          timeRefreshTrigger={timeRefreshTrigger}
          onContextMenu={handleContextMenu}
        />
      )
    },
    [
      appNameCache,
      closeConnection,
      displayAppName,
      displayIcon,
      findProcessMode,
      firstItemRefreshTrigger,
      handleContextMenu,
      hiddenRules,
      hideConnection,
      iconMap,
      selected,
      setIsDetailModalOpen,
      setSelected,
      timeRefreshTrigger,
      unhideConnection
    ]
  )

  if (filteredConnections.length === 0) {
    return (
      <div className="h-[calc(100vh-100px)] overflow-y-auto">
        <EmptyState
          icon={<IoLink />}
          title={tab === 'active' ? '暂无活动连接' : '暂无已关闭连接'}
          description="连接信息将在这里显示"
        />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-100px)] overflow-y-auto">
      {viewMode === 'table' ? (
        <ConnectionTable
          connections={filteredConnections}
          selected={selected}
          setSelected={setSelected}
          setIsDetailModalOpen={setIsDetailModalOpen}
          close={closeConnection}
          iconMap={iconMap}
          appNameCache={appNameCache}
          displayIcon={displayIcon && findProcessMode !== 'off'}
          displayAppName={displayAppName}
          sortBy={connectionOrderBy}
          sortDirection={connectionDirection}
          onSort={handleTableSort}
          onContextMenu={handleContextMenu}
          onVisibleRangeChange={handleVisibleRangeChange}
          hiddenRules={hiddenRules}
        />
      ) : (
        <Virtuoso
          data={filteredConnections}
          itemContent={renderConnectionItem}
          rangeChanged={handleVisibleRangeChange}
        />
      )}
    </div>
  )
}
