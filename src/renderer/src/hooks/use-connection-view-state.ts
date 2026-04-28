import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useConnectionsStore } from '@renderer/store/use-connections-store'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { mihomoCloseAllConnections, mihomoCloseConnection } from '@renderer/utils/mihomo-ipc'
import { useCallback, useEffect, useState } from 'react'
import {
  getConnectionHideRule,
  INITIAL_VISIBLE_RANGE,
  type ConnectionOrderBy,
  type ConnectionTab,
  type ConnectionViewMode,
  type VisibleRange
} from '@renderer/components/connections/shared'

export interface ConnectionViewState {
  // config-derived
  findProcessMode: string
  connectionDirection: 'asc' | 'desc'
  connectionOrderBy: ConnectionOrderBy
  displayIcon: boolean
  displayAppName: boolean
  patchAppConfig: (patch: Partial<AppConfig>) => Promise<void>

  // store
  activeConnections: import('@renderer/store/use-connections-store').ExtendedConnection[]
  closedConnections: import('@renderer/store/use-connections-store').ExtendedConnection[]
  isPaused: boolean
  setPaused: (paused: boolean) => void
  trashClosedConnection: (id: string) => void
  trashAllClosedConnections: () => void

  // local view state
  filter: string
  tab: ConnectionTab
  viewMode: ConnectionViewMode
  expandedGroups: Set<string>
  visibleRange: VisibleRange
  hiddenRules: Set<string>
  showHidden: boolean
  timeRefreshTrigger: number

  // setters
  setFilter: React.Dispatch<React.SetStateAction<string>>
  setShowHidden: React.Dispatch<React.SetStateAction<boolean>>
  setViewMode: React.Dispatch<React.SetStateAction<ConnectionViewMode>>

  // actions
  closeConnection: (id: string) => void
  closeAllConnections: () => void
  updateHiddenRules: (updater: (rules: Set<string>) => Set<string>) => void
  handleTabChange: (tab: ConnectionTab) => void
  handleVisibleRangeChange: (range: VisibleRange) => void
  handleOrderByChange: (orderBy: ConnectionOrderBy) => Promise<void>
  handleDirectionToggle: () => Promise<void>
  handleTableSort: (column: string) => void
  toggleGroup: (process: string) => void
  resetVisibleRange: () => void
}

import { CONNECTION_TABLE_SORT_COLUMNS } from '@renderer/components/connections/shared'

export function useConnectionViewState(): ConnectionViewState {
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

  // 时间刷新驱动（每分钟触发一次，用于更新连接时长显示）
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRefreshTrigger((v) => v + 1)
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  const closeAllConnections = useCallback((): void => {
    if (tab === 'active') {
      void mihomoCloseAllConnections()
      return
    }
    trashAllClosedConnections()
  }, [tab, trashAllClosedConnections])

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

  const resetVisibleRange = useCallback(() => {
    setVisibleRange(INITIAL_VISIBLE_RANGE)
  }, [])

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
    trashClosedConnection,
    trashAllClosedConnections,
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
  }
}
