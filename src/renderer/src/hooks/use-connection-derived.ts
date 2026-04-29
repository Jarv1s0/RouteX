import { includesIgnoreCase } from '@renderer/utils/includes'
import { useDeferredValue, useMemo } from 'react'
import {
  getConnectionHideRule,
  type ConnectionOrderBy,
  type ConnectionTab
} from '@renderer/components/connections/shared'

const connectionSearchCache = new WeakMap<ControllerConnectionDetail, string>()
const connectionStartCache = new WeakMap<ControllerConnectionDetail, number>()
const connectionTypeCache = new WeakMap<ControllerConnectionDetail, string>()

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

interface DerivedConnectionsInput {
  activeConnections: ControllerConnectionDetail[]
  closedConnections: ControllerConnectionDetail[]
  tab: ConnectionTab
  filter: string
  showHidden: boolean
  hiddenRules: Set<string>
  connectionOrderBy: ConnectionOrderBy
  connectionDirection: 'asc' | 'desc'
}

export interface DerivedConnectionsResult {
  filteredConnections: ControllerConnectionDetail[]
  connectionMap: Map<string, ControllerConnectionDetail>
}

export function useDerivedConnections({
  activeConnections,
  closedConnections,
  tab,
  filter,
  showHidden,
  hiddenRules,
  connectionOrderBy,
  connectionDirection
}: DerivedConnectionsInput): DerivedConnectionsResult {
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
    if (!deferredOrder || deferredFilter !== '') {
      return searchedConnections
    }
    return sortConnections(searchedConnections, deferredOrder, deferredDirection)
  }, [deferredDirection, deferredFilter, deferredOrder, searchedConnections])

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

  return {
    filteredConnections,
    connectionMap
  }
}
