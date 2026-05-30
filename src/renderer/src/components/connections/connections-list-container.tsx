import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useConnectionsStore } from '@renderer/store/use-connections-store'
import { useDerivedConnections } from '@renderer/hooks/use-connection-derived'
import { useResourceQueue } from '@renderer/hooks/use-resource-queue'
import { isMihomoProcessPath } from '@renderer/utils/mihomo-process'
import { RESOURCE_PRELOAD_BUFFER, getConnectionHideRule } from '@renderer/components/connections/shared'
import { useI18n } from '@renderer/i18n'
import { Button } from '@heroui/react'
import { IoAddCircleOutline } from 'react-icons/io5'

import ConnectionDetailModal from '@renderer/components/connections/connection-detail-modal'
import CreateRuleModal from '@renderer/components/connections/create-rule-modal'
import ConnectionsContent from '@renderer/components/connections/connections-content'
import ConnectionsToolbar from '@renderer/components/connections/connections-toolbar'
import { CustomContextMenu } from '@renderer/components/ui/custom-context-menu'
import { useConnectionViewState } from '@renderer/hooks/use-connection-view-state'

const ConnectionsListContainer = React.memo(function ConnectionsListContainer() {
  const { t } = useI18n()
  const viewState = useConnectionViewState()
  const {
    tab,
    viewMode,
    filter,
    showHidden,
    hiddenRules,
    connectionDirection,
    connectionOrderBy,
    displayIcon,
    displayAppName,
    findProcessMode,
    timeRefreshTrigger,
    visibleRange,
    closeConnection,
    closeAllConnections,
    updateHiddenRules,
    handleVisibleRangeChange,
    handleOrderByChange,
    handleDirectionToggle,
    handleTableSort,
    activeCount,
    closedCount,
    isPaused,
    setFilter,
    setShowHidden,
    setViewMode,
    setPaused,
    handleTabChange
  } = viewState

  const activeConnections = useConnectionsStore((state) => state.activeConnections)
  const closedConnections = useConnectionsStore((state) => state.closedConnections)

  const { filteredConnections, connectionMap } = useDerivedConnections({
    activeConnections,
    closedConnections,
    tab,
    filter,
    showHidden,
    hiddenRules,
    connectionOrderBy,
    connectionDirection
  })

  const handleBulkAction = useCallback(() => {
    if (filter === '') {
      closeAllConnections()
      return
    }

    filteredConnections.forEach((connection) => {
      closeConnection(connection.id)
    })
  }, [filter, closeAllConnections, filteredConnections, closeConnection])

  const hideConnection = useCallback((id: string) => {
    const connection = connectionMap.get(id)
    if (!connection) return

    const hideRule = getConnectionHideRule(connection)
    updateHiddenRules((previousRules) => new Set([...previousRules, hideRule]))
  }, [connectionMap, updateHiddenRules])

  const unhideConnection = useCallback((id: string) => {
    const connection = connectionMap.get(id)
    if (!connection) return

    const hideRule = getConnectionHideRule(connection)
    updateHiddenRules((previousRules) => {
      const nextRules = new Set(previousRules)
      nextRules.delete(hideRule)
      return nextRules
    })
  }, [connectionMap, updateHiddenRules])

  const clearAllHidden = useCallback((): void => {
    updateHiddenRules(() => new Set())
    localStorage.removeItem('hiddenConnectionRules')
  }, [updateHiddenRules])

  const { iconMap, appNameCache, firstItemRefreshTrigger, loadIcon, loadAppName } =
    useResourceQueue(
      displayIcon,
      displayAppName,
      findProcessMode,
      filteredConnections[0]?.metadata?.processPath
    )

  const iconLoadPlan = useMemo(() => {
    const visiblePaths = new Set<string>()
    const preloadPaths = new Set<string>()

    const visibleStart = Math.max(0, visibleRange.startIndex)
    const visibleEnd = Math.min(filteredConnections.length, visibleRange.endIndex + 1)
    const preloadStart = Math.max(0, visibleStart - RESOURCE_PRELOAD_BUFFER)
    const preloadEnd = Math.min(filteredConnections.length, visibleEnd + RESOURCE_PRELOAD_BUFFER)

    filteredConnections.slice(visibleStart, visibleEnd).forEach((connection) => {
      const processPath = connection.metadata.processPath || ''
      if (processPath && !isMihomoProcessPath(processPath)) {
        visiblePaths.add(processPath)
      }
    })

    filteredConnections.slice(preloadStart, preloadEnd).forEach((connection) => {
      const processPath = connection.metadata.processPath || ''
      if (!processPath || isMihomoProcessPath(processPath) || visiblePaths.has(processPath)) {
        return
      }

      preloadPaths.add(processPath)
    })

    return {
      visiblePaths: Array.from(visiblePaths),
      preloadPaths: Array.from(preloadPaths)
    }
  }, [filteredConnections, visibleRange])

  useEffect(() => {
    const canLoadIcons = displayIcon && findProcessMode !== 'off'
    if (!canLoadIcons && !displayAppName) return

    iconLoadPlan.visiblePaths.forEach((path) => {
      if (!path) return
      if (canLoadIcons) {
        loadIcon(path, true)
      }
      if (displayAppName) {
        loadAppName(path)
      }
    })

    iconLoadPlan.preloadPaths.forEach((path) => {
      if (!path) return
      if (canLoadIcons) {
        loadIcon(path, false)
      }
      if (displayAppName) {
        loadAppName(path)
      }
    })
  }, [
    displayAppName,
    displayIcon,
    filteredConnections,
    findProcessMode,
    iconLoadPlan,
    loadAppName,
    loadIcon,
    visibleRange
  ])

  // Modals and contextual states
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
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

  const handleContextMenu = useCallback(
    (connection: ControllerConnectionDetail, event: React.MouseEvent) => {
      event.preventDefault()
      setContextMenu({ isOpen: true, x: event.clientX, y: event.clientY, conn: connection })
    },
    []
  )

  const handleCreateRule = useCallback((connection: ControllerConnectionDetail) => {
    setCreateRuleConnection(connection)
    setIsCreateRuleModalOpen(true)
  }, [])

  useEffect(() => {
    if (!selected) return

    const latestSelected = connectionMap.get(selected.id)
    if (latestSelected && latestSelected !== selected) {
      setSelected(latestSelected)
    }
  }, [connectionMap, selected])

  return (
    <>
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
              {t('page.connections.createRule')}
            </Button>
          </div>
        </CustomContextMenu>
      )}

      <ConnectionsToolbar
        activeCount={activeCount}
        closedCount={closedCount}
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
    </>
  )
})

export default ConnectionsListContainer
