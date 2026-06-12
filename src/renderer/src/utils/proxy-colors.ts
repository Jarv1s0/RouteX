export type ProxyColor = 'danger' | 'success' | 'secondary' | 'primary' | 'warning' | 'default'

export function getProxyColor(proxy: string): ProxyColor {
  if (proxy === 'REJECT') return 'danger'
  if (proxy === 'DIRECT') return 'default'
  return 'secondary'
}
