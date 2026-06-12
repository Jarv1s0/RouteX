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
