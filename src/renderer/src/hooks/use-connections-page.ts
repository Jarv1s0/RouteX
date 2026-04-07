import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useConnectionsStore } from '@renderer/store/use-connections-store'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { useResourceQueue } from '@renderer/hooks/use-resource-queue'
import { includesIgnoreCase } from '@renderer/utils/includes'
import { mihomoCloseAllConnections, mihomoCloseConnection } from '@renderer/utils/mihomo-ipc'
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  CONNECTION_TABLE_SORT_COLUMNS,
  getConnectionHideRule,
  INITIAL_VISIBLE_RANGE,
  RESOURCE_PRELOAD_BUFFER,
  type ConnectionGroupData,
  type ConnectionOrderBy,
  type ConnectionTab,
  type ConnectionViewMode,
  type VisibleRange
} from '@renderer/components/connections/shared'

const connectionSearchCache = new WeakMap<ControllerConnectionDetail, string>()
const connectionStartCache = new WeakMap<ControllerConnectionDetail, number>()
const connectionTypeCache = new WeakMap<ControllerConnectionDetail, string>()
const EMPTY_GROUPED_CONNECTIONS: ConnectionGroupData[] = []

function getConnectionSearchText(connection: ControllerConnectionDetail): string {
  const cached = connectionSearchCache.get(connection)
  if (cached) return cached

  const searchableText = [
    connection.metadata.process,
    connection.metadata.host,
    connection.metadata.destinationIP,
    connection.metadata.sourceIP,
    connection.chains?.[0],
    connection.rule,
    connection.rulePayload
  ]
    .filter(Boolean)
    .join(' ')

  connectionSearchCache.set(connection, searchableText)
  return searchableText
}

function getConnectionStart(connection: ControllerConnectionDetail): number {
  const cached = connectionStartCache.get(connection)
  if (cached !== undefined) return cached

  const next = Date.parse(connection.start || '') || 0
  connectionStartCache.set(connection, next)
  return next
}

function getConnectionType(connection: ControllerConnectionDetail): string {
  const cached = connectionTypeCache.get(connection)
  if (cached) return cached

  const next = `${connection.metadata.type || ''}|${connection.metadata.network || ''}`
  connectionTypeCache.set(connection, next)
  return next
}

function sortConnections(
  connections: ControllerConnectionDetail[],
  orderBy: ConnectionOrderBy,
  direction: 'asc' | 'desc'
): ControllerConnectionDetail[] {
  const directionFactor = direction === 'asc' ? 1 : -1

  return [...connections].sort((left, right) => {
    switch (orderBy) {
      case 'time':
        return directionFactor * (getConnectionStart(right) - getConnectionStart(left))
      case 'upload':
        return directionFactor * (left.upload - right.upload)
      case 'download':
        return directionFactor * (left.download - right.download)
      case 'uploadSpeed':
        return directionFactor * ((left.uploadSpeed || 0) - (right.uploadSpeed || 0))
      case 'downloadSpeed':
        return directionFactor * ((left.downloadSpeed || 0) - (right.downloadSpeed || 0))
      case 'process':
        return directionFactor * (left.metadata.process || '').localeCompare(right.metadata.process || '')
      case 'type':
        return directionFactor * getConnectionType(left).localeCompare(getConnectionType(right))
      case 'rule':
        return directionFactor * (left.rule || '').localeCompare(right.rule || '')
      default:
        return 0
    }
  })
}

function groupConnections(connections: ControllerConnectionDetail[]): ConnectionGroupData[] {
  const groups = new Map<string, ConnectionGroupData>()

  connections.forEach((connection) => {
    const process = connection.metadata.process || 'Unknown Process'
    const processPath = connection.metadata.processPath || ''

    if (!groups.has(process)) {
      groups.set(process, {
        process,
        processPath,
        connections: [],
        totalUpload: 0,
        totalDownload: 0,
        uploadSpeed: 0,
        downloadSpeed: 0
      })
    }

    const currentGroup = groups.get(process)!
    currentGroup.connections.push(connection)
    currentGroup.totalUpload += connection.upload
    currentGroup.totalDownload += connection.download
    currentGroup.uploadSpeed += connection.uploadSpeed || 0
    currentGroup.downloadSpeed += connection.downloadSpeed || 0
  })

  return Array.from(groups.values()).sort((left, right) => {
    return right.connections.length - left.connections.length
  })
}

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
  const { controledMihomoConfig } = useControledMihomoConfig()
  const { 'find-process-mode': findProcessMode = 'always' } = controledMihomoConfig || {}
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    connectionDirection = 'asc',
    connectionOrderBy = 'time',
    displayIcon = true,
    displayAppName = true
  } = appConfig || {}

  const activeConnections = useConnectionsStore((state) => state.activeConnections)
  const closedConnections = useConnectionsStore((state) => state.closedConnections)
  const trashClosedConnection = useConnectionsStore((state) => state.trashClosedConnection)
  const trashAllClosedConnections = useConnectionsStore((state) => state.trashAllClosedConnections)
  const isPaused = useConnectionsStore((state) => state.isPaused)
  const setPaused = useConnectionsStore((state) => state.setPaused)

  const [filter, setFilter] = useState('')
  const [tab, setTab] = useState<ConnectionTab>('active')
  const [viewMode, setViewMode] = useState<ConnectionViewMode>('list')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [visibleRange, setVisibleRange] = useState<VisibleRange>(INITIAL_VISIBLE_RANGE)
  const [hiddenRules, setHiddenRules] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('hiddenConnectionRules')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })
  const [showHidden, setShowHidden] = useState(false)
  const [timeRefreshTrigger, setTimeRefreshTrigger] = useState(0)

  const deferredFilter = useDeferredValue(filter)
  const deferredOrder = useDeferredValue(connectionOrderBy)
  const deferredDirection = useDeferredValue(connectionDirection)
  const sourceConnections = tab === 'active' ? activeConnections : closedConnections
  const deferredSourceConnections = useDeferredValue(sourceConnections)

  const visibleConnections = useMemo(() => {
    if (showHidden || hiddenRules.size === 0) {
      return deferredSourceConnections
    }

    return deferredSourceConnections.filter((connection) => {
      return !hiddenRules.has(getConnectionHideRule(connection))
    })
  }, [deferredSourceConnections, hiddenRules, showHidden])

  const searchedConnections = useMemo(() => {
    if (deferredFilter === '') {
      return visibleConnections
    }

    return visibleConnections.filter((connection) => {
      return includesIgnoreCase(getConnectionSearchText(connection), deferredFilter)
    })
  }, [deferredFilter, visibleConnections])

  const filteredConnections = useMemo(() => {
    if (viewMode === 'group' || !deferredOrder || deferredFilter !== '') {
      return searchedConnections
    }

    return sortConnections(searchedConnections, deferredOrder, deferredDirection)
  }, [deferredDirection, deferredFilter, deferredOrder, searchedConnections, viewMode])

  const groupedConnections = useMemo<ConnectionGroupData[]>(() => {
    if (viewMode !== 'group') {
      return EMPTY_GROUPED_CONNECTIONS
    }

    return groupConnections(searchedConnections)
  }, [searchedConnections, viewMode])

  const closeAllConnections = useCallback((): void => {
    if (tab === 'active') {
      void mihomoCloseAllConnections()
      return
    }

    trashAllClosedConnections()
  }, [tab, trashAllClosedConnections])

  const connectionMap = useMemo(() => {
    const map = new Map<string, ControllerConnectionDetail>()

    activeConnections.forEach((connection) => {
      map.set(connection.id, connection)
    })
    closedConnections.forEach((connection) => {
      map.set(connection.id, connection)
    })

    return map
  }, [activeConnections, closedConnections])

  const closeConnection = useCallback(
    (id: string): void => {
      if (tab === 'active') {
        void mihomoCloseConnection(id)
        return
      }

      trashClosedConnection(id)
    },
    [tab, trashClosedConnection]
  )

  const updateHiddenRules = useCallback((updater: (rules: Set<string>) => Set<string>) => {
    setHiddenRules((previousRules) => {
      const nextRules = updater(previousRules)
      localStorage.setItem('hiddenConnectionRules', JSON.stringify(Array.from(nextRules)))
      return nextRules
    })
  }, [])

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
    setHiddenRules(new Set())
    localStorage.removeItem('hiddenConnectionRules')
  }, [])

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

  useEffect(() => {
    setVisibleRange(INITIAL_VISIBLE_RANGE)
  }, [tab, viewMode, deferredFilter, deferredOrder, deferredDirection])

  const resourcePaths = useMemo(() => {
    const paths = new Set<string>()

    if (viewMode === 'group') {
      groupedConnections.forEach((group) => {
        if (group.processPath) {
          paths.add(group.processPath)
        }
      })
      return Array.from(paths)
    }

    const startIndex = Math.max(0, visibleRange.startIndex - RESOURCE_PRELOAD_BUFFER)
    const endIndex = Math.min(
      filteredConnections.length,
      visibleRange.endIndex + RESOURCE_PRELOAD_BUFFER + 1
    )

    filteredConnections.slice(startIndex, endIndex).forEach((connection) => {
      const processPath = connection.metadata.processPath || ''
      if (processPath) {
        paths.add(processPath)
      }
    })

    return Array.from(paths)
  }, [filteredConnections, groupedConnections, viewMode, visibleRange])

  useEffect(() => {
    const canLoadIcons = displayIcon && findProcessMode !== 'off'
    if (!canLoadIcons && !displayAppName) return

    const firstVisiblePath = filteredConnections[visibleRange.startIndex]?.metadata?.processPath

    resourcePaths.forEach((path) => {
      if (!path) return
      if (canLoadIcons) {
        loadIcon(path, path === firstVisiblePath)
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
    loadAppName,
    loadIcon,
    resourcePaths,
    visibleRange
  ])

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRefreshTrigger((previousValue) => previousValue + 1)
    }, 60000)

    return () => clearInterval(timer)
  }, [])

  const handleBulkAction = useCallback((): void => {
    if (filter === '') {
      closeAllConnections()
      return
    }

    filteredConnections.forEach((connection) => {
      closeConnection(connection.id)
    })
  }, [closeAllConnections, closeConnection, filter, filteredConnections])

  const handleTabChange = useCallback((nextTab: ConnectionTab) => {
    setTab(nextTab)
  }, [])

  const handleVisibleRangeChange = useCallback((range: VisibleRange) => {
    setVisibleRange(range)
  }, [])

  const handleOrderByChange = useCallback(
    async (orderBy: ConnectionOrderBy) => {
      await patchAppConfig({ connectionOrderBy: orderBy })
    },
    [patchAppConfig]
  )

  const handleDirectionToggle = useCallback(async () => {
    await patchAppConfig({
      connectionDirection: connectionDirection === 'asc' ? 'desc' : 'asc'
    })
  }, [connectionDirection, patchAppConfig])

  const handleTableSort = useCallback(
    (column: string) => {
      const nextOrderBy = CONNECTION_TABLE_SORT_COLUMNS[column]
      if (!nextOrderBy) return

      if (connectionOrderBy === nextOrderBy) {
        void patchAppConfig({
          connectionDirection: connectionDirection === 'asc' ? 'desc' : 'asc'
        })
        return
      }

      void patchAppConfig({ connectionOrderBy: nextOrderBy })
    },
    [connectionDirection, connectionOrderBy, patchAppConfig]
  )

  const toggleGroup = useCallback((process: string) => {
    setExpandedGroups((previousGroups) => {
      const nextGroups = new Set(previousGroups)
      if (nextGroups.has(process)) {
        nextGroups.delete(process)
      } else {
        nextGroups.add(process)
      }
      return nextGroups
    })
  }, [])

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
