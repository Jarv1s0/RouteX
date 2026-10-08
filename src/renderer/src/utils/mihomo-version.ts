export function hasMihomoUpdate(
  currentVersion: string | undefined,
  latestVersion: string | null | undefined,
  core: string
): boolean {
  if (!currentVersion || !latestVersion) return false

  if (core === 'mihomo-alpha') {
    return !currentVersion.includes(latestVersion)
  }

  const current = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(currentVersion.trim())
  const latest = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(latestVersion.trim())
  if (!current || !latest) return false

  for (let part = 1; part <= 3; part++) {
    const difference = Number(latest[part]) - Number(current[part])
    if (difference !== 0) return difference > 0
  }
  return false
}
