import { TranslationKey } from '@renderer/i18n'

const connectionRowRenderKeyCache = new WeakMap<ControllerConnectionDetail, string>()
const connectionChainDisplayCache = new WeakMap<ControllerConnectionDetail, string>()
const connectionStartTimeCache = new WeakMap<ControllerConnectionDetail, number>()

export function getConnectionStartTime(conn: ControllerConnectionDetail): number {
  const cached = connectionStartTimeCache.get(conn)
  if (cached !== undefined) return cached

  const next = Date.parse(conn.start || '') || 0
  connectionStartTimeCache.set(conn, next)
  return next
}

export function getConnectionChainDisplay(conn: ControllerConnectionDetail): string {
  const cached = connectionChainDisplayCache.get(conn)
  if (cached) return cached

  const chains = conn.chains || []
  const next = chains.length === 0 ? 'DIRECT' : chains.slice().reverse().join(' → ')
  connectionChainDisplayCache.set(conn, next)
  return next
}

export function formatDurationFromStartMs(
  startMs: number,
  t: (key: TranslationKey, values?: Record<string, string | number>) => string
): string {
  const seconds = Math.max(0, Math.floor((Date.now() - startMs) / 1000))
  if (seconds < 60) return t('connections.time.secondsAgo', { value: seconds })
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return t('connections.time.minutesAgo', { value: minutes })
  const hours = Math.floor(minutes / 60)
  return t('connections.time.hoursAgo', { value: hours })
}

export function getConnectionHost(conn: ControllerConnectionDetail): string {
  const metadata = conn.metadata
  return (
    metadata.host ||
    metadata.sniffHost ||
    metadata.destinationIP ||
    metadata.remoteDestination ||
    '-'
  )
}

export function getConnectionType(conn: ControllerConnectionDetail): string {
  return `${conn.metadata.type} | ${conn.metadata.network}`
}

export function getConnectionRule(conn: ControllerConnectionDetail): string {
  return conn.rulePayload ? `${conn.rule}: ${conn.rulePayload}` : conn.rule || '-'
}

export function getConnectionRowRenderKey(conn: ControllerConnectionDetail): string {
  const cached = connectionRowRenderKeyCache.get(conn)
  if (cached) return cached

  const metadata = conn.metadata
  const next = [
    metadata.process,
    metadata.processPath,
    metadata.host,
    metadata.destinationIP,
    metadata.remoteDestination,
    metadata.sniffHost,
    metadata.sourceIP,
    metadata.sourcePort,
    metadata.destinationPort,
    metadata.type,
    metadata.network,
    metadata.inboundName,
    metadata.inboundUser,
    conn.chains?.join('>'),
    conn.rule,
    conn.rulePayload,
    conn.start
  ].join('|')

  connectionRowRenderKeyCache.set(conn, next)
  return next
}
