const LOG_TYPE_STYLES: Record<
  string,
  {
    marker: string
    listBadge: string
    detailBadge: string
  }
> = {
  error: {
    marker: 'bg-danger',
    listBadge: 'border-danger/30 text-danger bg-danger/10',
    detailBadge: 'bg-danger/10 text-danger border-danger/20'
  },
  warning: {
    marker: 'bg-warning',
    listBadge: 'border-warning/30 text-warning bg-warning/10',
    detailBadge: 'bg-warning/10 text-warning border-warning/20'
  },
  info: {
    marker: 'bg-primary',
    listBadge: 'border-primary/30 text-primary bg-primary/10',
    detailBadge: 'bg-primary/10 text-primary border-primary/20'
  },
  debug: {
    marker: 'bg-slate-500',
    listBadge:
      'border-dashed border-slate-500/35 text-slate-600 bg-slate-500/10 dark:text-slate-300',
    detailBadge:
      'bg-slate-500/10 text-slate-600 border-dashed border-slate-500/35 dark:text-slate-300'
  }
}

const DEFAULT_LOG_TYPE_STYLE = {
  marker: 'bg-default',
  listBadge: 'border-default/30 text-default-500 bg-default/10',
  detailBadge: 'bg-default/10 text-default-500 border-default/20'
}

function getLogTypeStyle(type: string) {
  return LOG_TYPE_STYLES[type] ?? DEFAULT_LOG_TYPE_STYLE
}

export function getLogTypeMarkerClass(type: string): string {
  return getLogTypeStyle(type).marker
}

export function getLogTypeBadgeClass(type: string, variant: 'list' | 'detail'): string {
  const style = getLogTypeStyle(type)
  return variant === 'list' ? style.listBadge : style.detailBadge
}

const LOG_TAG_STYLES: Record<string, string> = {
  TCP: 'border-sky-500/30 text-sky-600 bg-sky-500/10 dark:text-sky-300',
  UDP: 'border-indigo-500/30 text-indigo-600 bg-indigo-500/10 dark:text-indigo-300',
  DNS: 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10 dark:text-emerald-300',
  TUN: 'border-amber-500/30 text-amber-600 bg-amber-500/10 dark:text-amber-300',
  RULE: 'border-purple-500/30 text-purple-600 bg-purple-500/10 dark:text-purple-300',
  SNIFFER: 'border-rose-500/30 text-rose-600 bg-rose-500/10 dark:text-rose-300'
}

export function getLogTagBadgeClass(tag: string): string {
  return (
    LOG_TAG_STYLES[tag.toUpperCase()] ??
    'border-default-300/40 text-default-600 bg-default-100/60 dark:text-default-300'
  )
}

export interface ParsedLogPayload {
  tag: string | null
  rest: string
  quickFilterToken: string | null
}

/**
 * 解析日志正文中的模块前缀与可快速过滤的关键字（优先进程名，其次模块名）。
 */
export function parseLogPayload(payload: string): ParsedLogPayload {
  const tagMatch = payload.match(/^\[([A-Za-z0-9_-]+)\]\s*(.*)$/)
  const tag = tagMatch ? tagMatch[1] : null
  const rest = tagMatch ? tagMatch[2] : payload

  const processMatch = rest.match(/\(([^()\s]+\.[A-Za-z0-9]+)\)/)
  const quickFilterToken = processMatch ? processMatch[1] : tag

  return { tag, rest, quickFilterToken }
}

/**
 * 列表行内使用短时间（HH:mm:ss 或 HH:mm:ss.SSS），保留完整时间用于详情与悬浮提示。
 */
export function formatDisplayLogTime(time?: string, shortTime?: string): string {
  if (shortTime) return shortTime
  if (!time) return ''
  const match = time.match(/(\d{1,2}:\d{2}:\d{2}(?:\.\d{1,3})?)$/)
  return match ? match[1] : time
}
