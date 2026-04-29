export type ConnectionTab = 'active' | 'closed'
export type ConnectionViewMode = 'list' | 'table'
export type ConnectionOrderBy =
  | 'time'
  | 'upload'
  | 'download'
  | 'uploadSpeed'
  | 'downloadSpeed'
  | 'process'
  | 'type'
  | 'rule'

export interface VisibleRange {
  startIndex: number
  endIndex: number
}

export const INITIAL_VISIBLE_RANGE: VisibleRange = { startIndex: 0, endIndex: 11 }
export const RESOURCE_PRELOAD_BUFFER = 8

export const CONNECTION_TABLE_SORT_COLUMNS: Record<string, ConnectionOrderBy> = {
  time: 'time',
  upload: 'upload',
  download: 'download',
  uploadSpeed: 'uploadSpeed',
  downloadSpeed: 'downloadSpeed',
  process: 'process',
  type: 'type',
  rule: 'rule'
}

export function getConnectionHideRule(
  connection: Pick<ControllerConnectionDetail, 'metadata'>
): string {
  return `${connection.metadata.process || 'unknown'}:${connection.metadata.host || connection.metadata.destinationIP || 'unknown'}`
}
