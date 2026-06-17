import { TranslationKey } from '@renderer/i18n'

// 列配置 - 默认宽度
export const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  close: 40,
  host: 200,
  process: 150,
  type: 100,
  rule: 150,
  chains: 200,
  downloadSpeed: 120,
  uploadSpeed: 120,
  download: 80,
  upload: 80,
  time: 90,
  sourceIP: 120,
  sourcePort: 80,
  destinationIP: 120,
  sniffHost: 150,
  inboundName: 100,
  inboundUser: 100
}

// 列标签
export const COLUMN_LABEL_KEYS: Record<string, TranslationKey> = {
  close: 'connections.column.close',
  host: 'connections.column.host',
  process: 'connections.column.process',
  type: 'connections.column.type',
  rule: 'connections.column.rule',
  chains: 'connections.column.chains',
  downloadSpeed: 'connections.column.shortDownloadSpeed',
  uploadSpeed: 'connections.column.shortUploadSpeed',
  download: 'connections.column.download',
  upload: 'connections.column.upload',
  time: 'connections.column.time',
  sourceIP: 'connections.column.sourceIP',
  sourcePort: 'connections.column.sourcePort',
  destinationIP: 'connections.column.destinationIP',
  sniffHost: 'connections.column.sniffHost',
  inboundName: 'connections.column.inboundName',
  inboundUser: 'connections.column.inboundUser'
}

// 右对齐的列
export const RIGHT_ALIGN_COLUMNS = ['downloadSpeed', 'uploadSpeed', 'download', 'upload', 'time']
