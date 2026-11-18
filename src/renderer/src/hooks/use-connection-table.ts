import { useEffect, useMemo, useRef, useState } from 'react'
import {
  functionalUpdate,
  useTable,
  type ColumnSizingState,
  type ColumnPinningState,
  type Updater,
  type SortingState
} from '@tanstack/react-table'
import { useAppConfig } from './use-app-config'
import { notifyError } from '@renderer/utils/notify'
import {
  connectionTableFeatures,
  connectionTableColumns,
  CONNECTION_COLUMN_IDS,
  normalizeConnectionSorting
} from '@renderer/components/connections/connection-table-model'
import { DEFAULT_COLUMNS, DEFAULT_COLUMN_WIDTHS } from '@renderer/components/connections/columns'
import type { ConnectionOrderBy } from '@renderer/components/connections/shared'

const EMPTY_WIDTHS: ColumnSizingState = {}
const EMPTY_PINNING: ColumnPinningState = { start: [], end: [] }

export function useConnectionTable(data: ControllerConnectionDetail[]) {
  const { appConfig, patchAppConfig } = useAppConfig()
  const config: Partial<AppConfig> = appConfig || {}
  const savedWidths = config.connectionTableColumnWidths || EMPTY_WIDTHS
  const [sizing, setSizing] = useState<ColumnSizingState>(savedWidths)
  const persistedSizing = useRef(JSON.stringify(savedWidths))
  const sizingChangedByUser = useRef(false)
  const latestSizing = useRef(sizing)
  latestSizing.current = sizing
  const saveWidths = useRef<() => void>(() => undefined)
  const writingWidths = useRef(false)
  const widthsQueued = useRef(false)
  const widthsMounted = useRef(true)
  useEffect(() => {
    widthsMounted.current = true
    return () => {
      widthsMounted.current = false
    }
  }, [])
  saveWidths.current = () => {
    if (writingWidths.current) {
      widthsQueued.current = true
      return
    }
    writingWidths.current = true
    const next = latestSizing.current
    persistedSizing.current = JSON.stringify(next)
    void patchAppConfig({ connectionTableColumnWidths: next })
      .catch((error) => {
        persistedSizing.current = JSON.stringify(savedWidths)
        if (!widthsQueued.current && widthsMounted.current && latestSizing.current === next)
          setSizing(savedWidths)
        notifyError(error)
      })
      .finally(() => {
        writingWidths.current = false
        if (widthsQueued.current) {
          widthsQueued.current = false
          saveWidths.current()
        }
      })
  }
  const order = useMemo(
    () =>
      [...new Set(config.connectionTableColumns || DEFAULT_COLUMNS)].filter((id) =>
        CONNECTION_COLUMN_IDS.includes(id)
      ),
    [config.connectionTableColumns]
  )
  const visibility = useMemo(
    () => Object.fromEntries(CONNECTION_COLUMN_IDS.map((id) => [id, order.includes(id)])),
    [order]
  )
  const sorting = useMemo(
    () => normalizeConnectionSorting(config),
    [config.connectionTableSorting, config.connectionOrderBy, config.connectionDirection]
  )
  const pinning = useMemo(() => {
    const saved = config.connectionTablePinning || EMPTY_PINNING
    const start = [...new Set(saved.start)].filter((id) => CONNECTION_COLUMN_IDS.includes(id))
    return {
      start,
      end: [...new Set(saved.end)].filter(
        (id) => CONNECTION_COLUMN_IDS.includes(id) && !start.includes(id)
      )
    }
  }, [config.connectionTablePinning])
  const save = (patch: Partial<AppConfig>): void => {
    void patchAppConfig(patch).catch((error) => notifyError(error))
  }
  const table = useTable({
    features: connectionTableFeatures,
    columns: connectionTableColumns,
    data,
    getRowId: (connection) => connection.id,
    state: {
      sorting,
      columnOrder: order,
      columnVisibility: visibility,
      columnSizing: sizing,
      columnPinning: pinning
    },
    enableSortingRemoval: false,
    enableMultiSort: true,
    maxMultiSortColCount: 8,
    columnResizeMode: 'onChange',
    onColumnSizingChange: (updater) => {
      sizingChangedByUser.current = true
      setSizing((previous) => {
        const next = { ...functionalUpdate(updater, previous) }
        // Configuration patches merge maps recursively; explicitly save default
        // sizes when TanStack removes a size override during reset.
        for (const id of Object.keys(previous)) {
          if (!(id in next) && id in DEFAULT_COLUMN_WIDTHS) next[id] = DEFAULT_COLUMN_WIDTHS[id]
        }
        return next
      })
    },
    onSortingChange: (updater: Updater<SortingState>) => {
      const next = functionalUpdate(updater, sorting)
      if (!next.length) return
      save({
        connectionTableSorting: next,
        connectionOrderBy: next[0].id as ConnectionOrderBy,
        connectionDirection: next[0].desc ? 'desc' : 'asc'
      })
    },
    onColumnPinningChange: (updater: Updater<ColumnPinningState>) =>
      save({ connectionTablePinning: functionalUpdate(updater, pinning) }),
    onColumnOrderChange: (updater) => {
      const next = functionalUpdate(updater, order)
      save({
        connectionTableColumns: next.filter((id) => visibility[id]),
        connectionTablePinning: {
          start: next.filter((id) => pinning.start.includes(id)),
          end: next.filter((id) => pinning.end.includes(id))
        }
      })
    },
    onColumnVisibilityChange: (updater) => {
      const next = functionalUpdate(updater, visibility)
      save({
        connectionTableColumns: [...new Set([...order, ...CONNECTION_COLUMN_IDS])].filter(
          (id) => next[id] !== false
        )
      })
    }
  })
  const resizing = table.state.columnResizing.isResizingColumn
  useEffect(() => {
    const encoded = JSON.stringify(savedWidths)
    if (persistedSizing.current !== encoded) {
      persistedSizing.current = encoded
      if (!resizing && !writingWidths.current) setSizing(savedWidths)
    }
  }, [savedWidths])
  useEffect(() => {
    if (resizing || !sizingChangedByUser.current) return
    sizingChangedByUser.current = false
    const encoded = JSON.stringify(sizing)
    if (encoded === persistedSizing.current) return
    saveWidths.current()
  }, [resizing, sizing, patchAppConfig, savedWidths])
  return table
}

export type ConnectionTableInstance = ReturnType<typeof useConnectionTable>
