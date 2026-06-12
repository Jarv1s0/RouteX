export interface DelayThresholds {
  good: number
  fair: number
}

export function getDelayColorClass(
  delay: number,
  thresholds: DelayThresholds,
  unknownClass?: string
): string {
  if (delay === -1 && unknownClass) return unknownClass
  if (delay === 0) return 'text-danger'
  if (delay < thresholds.good) return 'text-success'
  if (delay < thresholds.fair) return 'text-warning'
  return 'text-danger'
}

export function getDelayColor(
  delay: number,
  thresholds: DelayThresholds
): 'primary' | 'success' | 'warning' | 'danger' {
  if (delay === -1) return 'primary'
  if (delay === 0) return 'danger'
  if (delay < thresholds.good) return 'success'
  if (delay < thresholds.fair) return 'warning'
  return 'danger'
}

export function getBoundedDelayColor(
  delay: number | undefined,
  goodLimit: number,
  fairLimit: number
): 'success' | 'warning' | 'danger' | 'default' {
  if (delay === undefined || delay < 0) return 'default'
  if (delay === 0) return 'danger'
  if (delay <= goodLimit) return 'success'
  if (delay <= fairLimit) return 'warning'
  return 'danger'
}
