export type ProxyColor = 'danger' | 'success' | 'secondary' | 'primary' | 'warning' | 'default'

export const NEUTRAL_CHIP_CLASSNAME =
  'border border-default-300/75 bg-default-200/70 text-foreground/85 dark:border-white/15 dark:bg-white/[0.09] dark:text-foreground/90'

export function getProxyColor(proxy: string): ProxyColor {
  if (proxy === 'REJECT') return 'danger'
  if (proxy === 'DIRECT') return 'default'
  return 'secondary'
}

export function getProxyChipClassName(proxy: string): string {
  return getProxyColor(proxy) === 'default' ? NEUTRAL_CHIP_CLASSNAME : ''
}
