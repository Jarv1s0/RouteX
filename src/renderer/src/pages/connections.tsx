import BasePage from '@renderer/components/base/base-page'
import ConnectionDetailModal from '@renderer/components/connections/connection-detail-modal'
import CreateRuleModal from '@renderer/components/connections/create-rule-modal'
import ConnectionsContent from '@renderer/components/connections/connections-content'
import ConnectionSettingModal from '@renderer/components/connections/connection-setting-modal'
import ConnectionsToolbar from '@renderer/components/connections/connections-toolbar'
import { CustomContextMenu } from '@renderer/components/ui/custom-context-menu'
import { useConnectionsPage } from '@renderer/hooks/use-connections-page'
import { Button } from '@heroui/react'
import React, { useCallback, useEffect, useState } from 'react'
import { MdTune } from 'react-icons/md'
import { IoAddCircleOutline, IoPause } from 'react-icons/io5'

const Connections: React.FC = () => {
  const {
    activeConnections,
    closedConnections,
    filteredConnections,
    tab,
    viewMode,
    filter,
    showHidden,
    hiddenRules,
    isPaused,
    timeRefreshTrigger,
    connectionDirection,
    connectionOrderBy,
    displayIcon,
    displayAppName,
    findProcessMode,
    iconMap,
    appNameCache,
    firstItemRefreshTrigger,
    setFilter,
    setShowHidden,
    setPaused,
    setViewMode,
    closeConnection,
    hideConnection,
    unhideConnection,
    clearAllHidden,
    handleBulkAction,
    handleTabChange,
    handleVisibleRangeChange,
    handleOrderByChange,
    handleDirectionToggle,
    handleTableSort
  } = useConnectionsPage()

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isSettingModalOpen, setIsSettingModalOpen] = useState(false)
  const [isCreateRuleModalOpen, setIsCreateRuleModalOpen] = useState(false)
  const [selected, setSelected] = useState<ControllerConnectionDetail>()
  const [createRuleConnection, setCreateRuleConnection] = useState<ControllerConnectionDetail>()
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean
    x: number
    y: number
    conn?: ControllerConnectionDetail
  }>({ isOpen: false, x: 0, y: 0 })

  const closeContextMenu = useCallback(() => {
    setContextMenu((previousState) => ({ ...previousState, isOpen: false }))
  }, [])

  const handleContextMenu = useCallback((connection: ControllerConnectionDetail, event: React.MouseEvent) => {
    event.preventDefault()
    setContextMenu({ isOpen: true, x: event.clientX, y: event.clientY, conn: connection })
  }, [])

  const handleCreateRule = useCallback((connection: ControllerConnectionDetail) => {
    setCreateRuleConnection(connection)
    setIsCreateRuleModalOpen(true)
  }, [])

  useEffect(() => {
    if (!selected) return

    const latestSelected = activeConnections.find((connection) => connection.id === selected.id)
      || closedConnections.find((connection) => connection.id === selected.id)

    if (latestSelected && latestSelected !== selected) {
      setSelected(latestSelected)
    }
  }, [activeConnections, closedConnections, selected])

  return (
    <BasePage
      title="连接"
      header={
        <Button
          size="sm"
          isIconOnly
          className="app-nodrag"
          variant="light"
          title="连接设置"
          onPress={() => setIsSettingModalOpen(true)}
        >
          <MdTune className="text-lg" />
        </Button>
      }
    >
      {isDetailModalOpen && selected && (
        <ConnectionDetailModal
          onClose={() => setIsDetailModalOpen(false)}
          connection={selected}
          onDisconnect={
            tab === 'active'
              ? (id) => {
                  closeConnection(id)
                  setIsDetailModalOpen(false)
                }
              : undefined
          }
        />
      )}

      {isCreateRuleModalOpen && createRuleConnection && (
        <CreateRuleModal
          connection={createRuleConnection}
          onClose={() => setIsCreateRuleModalOpen(false)}
        />
      )}

      {contextMenu.isOpen && (
        <CustomContextMenu
          isOpen={contextMenu.isOpen}
          onClose={closeContextMenu}
          position={{ x: contextMenu.x, y: contextMenu.y }}
        >
          <div className="flex flex-col">
            <Button
              size="sm"
              variant="light"
              className="w-full justify-start h-9 px-3 min-w-[140px] font-medium text-default-700 gap-2"
              startContent={<IoAddCircleOutline className="text-lg text-primary" />}
              onPress={() => {
                if (contextMenu.conn) {
                  handleCreateRule(contextMenu.conn)
                  closeContextMenu()
                }
              }}
            >
              新建规则
            </Button>
          </div>
        </CustomContextMenu>
      )}

      {isSettingModalOpen && <ConnectionSettingModal onClose={() => setIsSettingModalOpen(false)} />}

      {isPaused && (
        <div className="sticky top-0 z-50 bg-warning/10 border-b border-warning/30 px-4 py-2 flex items-center justify-center gap-2">
          <IoPause className="text-warning text-sm" />
          <span className="text-xs text-warning font-medium">连接列表已暂停刷新</span>
        </div>
      )}

      <ConnectionsToolbar
        activeCount={activeConnections.length}
        closedCount={closedConnections.length}
        tab={tab}
        viewMode={viewMode}
        filter={filter}
        connectionOrderBy={connectionOrderBy}
        connectionDirection={connectionDirection}
        isPaused={isPaused}
        showHidden={showHidden}
        hiddenRulesCount={hiddenRules.size}
        setFilter={setFilter}
        setViewMode={setViewMode}
        setPaused={setPaused}
        setShowHidden={setShowHidden}
        onTabChange={handleTabChange}
        onOrderByChange={handleOrderByChange}
        onDirectionToggle={handleDirectionToggle}
        onBulkAction={handleBulkAction}
        onClearAllHidden={clearAllHidden}
      />

      <ConnectionsContent
        tab={tab}
        viewMode={viewMode}
        filteredConnections={filteredConnections}
        selected={selected}
        displayIcon={displayIcon}
        displayAppName={displayAppName}
        findProcessMode={findProcessMode}
        iconMap={iconMap}
        appNameCache={appNameCache}
        hiddenRules={hiddenRules}
        timeRefreshTrigger={timeRefreshTrigger}
        firstItemRefreshTrigger={firstItemRefreshTrigger}
        connectionOrderBy={connectionOrderBy}
        connectionDirection={connectionDirection}
        setSelected={setSelected}
        setIsDetailModalOpen={setIsDetailModalOpen}
        closeConnection={closeConnection}
        hideConnection={hideConnection}
        unhideConnection={unhideConnection}
        handleContextMenu={handleContextMenu}
        handleVisibleRangeChange={handleVisibleRangeChange}
        handleTableSort={handleTableSort}
      />
    </BasePage>
  )
}

export default Connections
