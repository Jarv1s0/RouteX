type MihomoCore = 'mihomo' | 'mihomo-alpha' | string

function extractStableVersion(value?: string | null): number[] | null {
  const match = value?.match(/v?(\d+)\.(\d+)\.(\d+)/i)
  if (!match) return null

  return match.slice(1).map((part) => Number.parseInt(part, 10))
}

function compareVersionParts(left: number[], right: number[]): number {
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const leftPart = left[index] ?? 0
    const rightPart = right[index] ?? 0

    if (leftPart > rightPart) return 1
    if (leftPart < rightPart) return -1
  }

  return 0
}

export function hasMihomoCoreUpdate(
  currentVersion?: string | null,
  latestVersion?: string | null,
  core: MihomoCore = 'mihomo'
): boolean {
  if (!currentVersion || !latestVersion) return false

  if (core === 'mihomo-alpha') {
    return !currentVersion.includes(latestVersion)
  }

  const current = extractStableVersion(currentVersion)
  const latest = extractStableVersion(latestVersion)

  if (!current || !latest) return false

  return compareVersionParts(latest, current) > 0
}
