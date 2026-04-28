import { useResourceQueue } from '@renderer/hooks/use-resource-queue'
import { useConnectionViewState } from '@renderer/hooks/use-connection-view-state'
import { useDerivedConnections } from '@renderer/hooks/use-connection-derived'
import { useCallback, useEffect, useMemo } from 'react'
import {
  getConnectionHideRule,
  RESOURCE_PRELOAD_BUFFER,
  type ConnectionGroupData,
  type ConnectionOrderBy,
  type ConnectionTab,
  type ConnectionViewMode,
  type VisibleRange
} from '@renderer/components/connections/shared'

interface UseConnectionsPageResult {
  activeConnections: ControllerConnectionDetail[]
  closedConnections: ControllerConnectionDetail[]
  filteredConnections: ControllerConnectionDetail[]
  groupedConnections: ConnectionGroupData[]
  expandedGroups: Set<string>
  tab: ConnectionTab
  viewMode: ConnectionViewMode
  filter: string
  showHidden: boolean
  hiddenRules: Set<string>
  isPaused: boolean
  timeRefreshTrigger: number
  visibleRange: VisibleRange
  connectionDirection: 'asc' | 'desc'
  connectionOrderBy: ConnectionOrderBy
  tableSortBy: ConnectionOrderBy | undefined
  displayIcon: boolean
  displayAppName: boolean
  findProcessMode: string
  iconMap: Record<string, string>
  appNameCache: Record<string, string>
  firstItemRefreshTrigger: number
  setFilter: React.Dispatch<React.SetStateAction<string>>
  setShowHidden: React.Dispatch<React.SetStateAction<boolean>>
  setPaused: (paused: boolean) => void
  setViewMode: React.Dispatch<React.SetStateAction<ConnectionViewMode>>
  closeConnection: (id: string) => void
  hideConnection: (id: string) => void
  unhideConnection: (id: string) => void
  clearAllHidden: () => void
  handleBulkAction: () => void
  handleTabChange: (tab: ConnectionTab) => void
  handleVisibleRangeChange: (range: VisibleRange) => void
  handleOrderByChange: (orderBy: ConnectionOrderBy) => Promise<void>
  handleDirectionToggle: () => Promise<void>
  handleTableSort: (column: string) => void
  toggleGroup: (process: string) => void
}

export function useConnectionsPage(): UseConnectionsPageResult {
  const {
    findProcessMode,
    connectionDirection,
    connectionOrderBy,
    displayIcon,
    displayAppName,
    patchAppConfig,
    activeConnections,
    closedConnections,
    isPaused,
    setPaused,
    filter,
    tab,
    viewMode,
    expandedGroups,
    visibleRange,
    hiddenRules,
    showHidden,
    timeRefreshTrigger,
    setFilter,
    setShowHidden,
    setViewMode,
    closeConnection,
    closeAllConnections,
    updateHiddenRules,
    handleTabChange,
    handleVisibleRangeChange,
    handleOrderByChange,
    handleDirectionToggle,
    handleTableSort,
    toggleGroup,
    resetVisibleRange
  } = useConnectionViewState()

  const { filteredConnections, groupedConnections, connectionMap } = useDerivedConnections({
    activeConnections,
    closedConnections,
    tab,
    filter,
    showHidden,
    hiddenRules,
    viewMode,
    connectionOrderBy,
    connectionDirection
  })

  const hideConnection = useCallback(
    (id: string) => {
      const connection = connectionMap.get(id)
      if (!connection) return

      const hideRule = getConnectionHideRule(connection)
      updateHiddenRules((previousRules) => new Set([...previousRules, hideRule]))
    },
    [connectionMap, updateHiddenRules]
  )

  const unhideConnection = useCallback(
    (id: string) => {
      const connection = connectionMap.get(id)
      if (!connection) return

      const hideRule = getConnectionHideRule(connection)
      updateHiddenRules((previousRules) => {
        const nextRules = new Set(previousRules)
        nextRules.delete(hideRule)
        return nextRules
      })
    },
    [connectionMap, updateHiddenRules]
  )

  const clearAllHidden = useCallback((): void => {
    updateHiddenRules(() => new Set())
    localStorage.removeItem('hiddenConnectionRules')
  }, [updateHiddenRules])

  const {
    iconMap,
    appNameCache,
    firstItemRefreshTrigger,
    loadIcon,
    loadAppName
  } = useResourceQueue(
    displayIcon,
    displayAppName,
    findProcessMode,
    filteredConnections[0]?.metadata?.processPath
  )

  const deferredFilter = filter
  const deferredOrder = connectionOrderBy
  const deferredDirection = connectionDirection

  useEffect(() => {
    resetVisibleRange()
  }, [tab, viewMode, deferredFilter, deferredOrder, deferredDirection, resetVisibleRange])

  const iconLoadPlan = useMemo(() => {
    const visiblePaths = new Set<string>()
    const preloadPaths = new Set<string>()

    if (viewMode === 'group') {
      groupedConnections.forEach((group) => {
        if (group.processPath) {
          visiblePaths.add(group.processPath)
        }
      })

      return {
        visiblePaths: Array.from(visiblePaths),
        preloadPaths: [] as string[]
      }
    }

    const visibleStart = Math.max(0, visibleRange.startIndex)
    const visibleEnd = Math.min(filteredConnections.length, visibleRange.endIndex + 1)
    const preloadStart = Math.max(0, visibleStart - RESOURCE_PRELOAD_BUFFER)
    const preloadEnd = Math.min(filteredConnections.length, visibleEnd + RESOURCE_PRELOAD_BUFFER)

    filteredConnections.slice(visibleStart, visibleEnd).forEach((connection) => {
      const processPath = connection.metadata.processPath || ''
      if (processPath) {
        visiblePaths.add(processPath)
      }
    })

    filteredConnections.slice(preloadStart, preloadEnd).forEach((connection) => {
      const processPath = connection.metadata.processPath || ''
      if (!processPath || visiblePaths.has(processPath)) {
        return
      }

      preloadPaths.add(processPath)
    })

    return {
      visiblePaths: Array.from(visiblePaths),
      preloadPaths: Array.from(preloadPaths)
    }
  }, [filteredConnections, groupedConnections, viewMode, visibleRange])

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

  const handleBulkAction = useCallback((): void => {
    if (filter === '') {
      closeAllConnections()
      return
    }

    filteredConnections.forEach((connection) => {
      closeConnection(connection.id)
    })
  }, [closeAllConnections, closeConnection, filter, filteredConnections])


  return {
    activeConnections,
    closedConnections,
    filteredConnections,
    groupedConnections,
    expandedGroups,
    tab,
    viewMode,
    filter,
    showHidden,
    hiddenRules,
    isPaused,
    timeRefreshTrigger,
    visibleRange,
    connectionDirection,
    connectionOrderBy,
    tableSortBy: connectionOrderBy,
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
    handleTableSort,
    toggleGroup
  }
}
