import {
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  type SortingState
} from '@tanstack/react-table'
import { COLUMN_LABEL_KEYS, DEFAULT_COLUMN_WIDTHS } from './columns'
import { CONNECTION_TABLE_SORT_COLUMNS } from './shared'
import { getConnectionStartTime, getConnectionType } from './connection-row-utils'

export const connectionTableFeatures = tableFeatures({
  columnOrderingFeature,
  columnVisibilityFeature,
  columnSizingFeature,
  columnResizingFeature,
  columnPinningFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel()
})
const helper = createColumnHelper<typeof connectionTableFeatures, ControllerConnectionDetail>()
export const CONNECTION_COLUMN_IDS = Object.keys(COLUMN_LABEL_KEYS)

function sortValue(connection: ControllerConnectionDetail, key: string): string | number {
  switch (key) {
    // Keep the existing "ascending time" behavior: newest connections first.
    case 'time':
      return -getConnectionStartTime(connection)
    case 'process':
      return connection.metadata.process || ''
    case 'type':
      return getConnectionType(connection)
    case 'rule':
      return connection.rule || ''
    case 'upload':
      return connection.upload
    case 'download':
      return connection.download
    case 'uploadSpeed':
      return connection.uploadSpeed || 0
    case 'downloadSpeed':
      return connection.downloadSpeed || 0
    default:
      return ''
  }
}

export const connectionTableColumns = helper.columns(
  CONNECTION_COLUMN_IDS.map((id) =>
    helper.accessor((connection) => sortValue(connection, id), {
      id,
      size: DEFAULT_COLUMN_WIDTHS[id],
      minSize: 40,
      maxSize: 1600,
      enableSorting: id in CONNECTION_TABLE_SORT_COLUMNS,
      sortDescFirst: false,
      sortFn: (left, right, key) => {
        const a = left.getValue<string | number>(key)
        const b = right.getValue<string | number>(key)
        return typeof a === 'number' && typeof b === 'number'
          ? a - b
          : String(a).localeCompare(String(b))
      }
    })
  )
)

export function normalizeConnectionSorting(config: Partial<AppConfig>): SortingState {
  const primary = {
    id: config.connectionOrderBy || 'time',
    desc: config.connectionDirection === 'desc'
  }
  const saved = config.connectionTableSorting?.filter(
    (sort, index, all) =>
      sort.id in CONNECTION_TABLE_SORT_COLUMNS &&
      typeof sort.desc === 'boolean' &&
      all.findIndex((other) => other.id === sort.id) === index
  )
  return saved?.length && saved[0].id === primary.id && saved[0].desc === primary.desc
    ? saved
    : [primary]
}
