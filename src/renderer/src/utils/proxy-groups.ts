export function resolveFinalProxyNode(
  groups: Pick<ControllerGroupDetail, 'name' | 'now'>[],
  proxyName: string,
  visited: Set<string> = new Set()
): string | null {
  if (visited.has(proxyName)) return null
  visited.add(proxyName)

  const group = groups.find((item) => item.name === proxyName)
  if (!group || !group.now) return null

  const subGroup = groups.find((item) => item.name === group.now)
  return subGroup ? resolveFinalProxyNode(groups, group.now, visited) : group.now
}
