const MIHOMO_PROCESS_NAMES = new Set(['mihomo', 'mihomo-alpha'])

export function isMihomoProcessPath(path?: string | null): boolean {
  if (!path) return false

  const normalized = path.trim().replace(/\\/g, '/').toLowerCase()
  const filename = normalized.split('/').pop()?.replace(/\.exe$/, '')

  return filename ? MIHOMO_PROCESS_NAMES.has(filename) : false
}
