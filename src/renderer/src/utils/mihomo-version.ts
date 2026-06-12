export function hasMihomoUpdate(
  currentVersion: string | undefined,
  latestVersion: string | null | undefined,
  core: string
): boolean {
  if (!currentVersion || !latestVersion) return false

  if (core === 'mihomo-alpha') {
    return !currentVersion.includes(latestVersion)
  }

  const current = currentVersion.replace(/^v/, '')
  const latest = latestVersion.replace(/^v/, '')
  return current !== latest && latest > current
}
