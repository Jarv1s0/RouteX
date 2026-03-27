import { C, invokeSafe } from './ipc-core'

export async function mihomoVersion(): Promise<ControllerVersion> {
  return invokeSafe(C.mihomoVersion)
}

export async function mihomoConfig(): Promise<ControllerConfigs> {
  return invokeSafe(C.mihomoConfig)
}

export async function mihomoRules(): Promise<ControllerRules> {
  return invokeSafe(C.mihomoRules)
}

export async function mihomoProxies(): Promise<ControllerProxies> {
  return invokeSafe(C.mihomoProxies)
}

export async function mihomoGroups(): Promise<ControllerMixedGroup[]> {
  return invokeSafe(C.mihomoGroups)
}

export async function mihomoCloseConnection(id: string): Promise<void> {
  return invokeSafe(C.mihomoCloseConnection, id)
}

export async function mihomoRuleProviders(): Promise<ControllerRuleProviders> {
  return invokeSafe(C.mihomoRuleProviders)
}

export async function mihomoProxyProviders(): Promise<ControllerProxyProviders> {
  return invokeSafe(C.mihomoProxyProviders)
}

export async function mihomoChangeProxy(
  group: string,
  proxy: string
): Promise<ControllerProxiesDetail> {
  return invokeSafe(C.mihomoChangeProxy, group, proxy)
}

export async function mihomoUnfixedProxy(group: string): Promise<ControllerProxiesDetail> {
  return invokeSafe(C.mihomoUnfixedProxy, group)
}

export async function mihomoGroupDelay(
  group: string,
  url?: string
): Promise<ControllerGroupDelay> {
  return invokeSafe(C.mihomoGroupDelay, group, url)
}

export async function getRuntimeConfig(): Promise<MihomoConfig> {
  return invokeSafe(C.getRuntimeConfig)
}

export async function restartCore(): Promise<void> {
  return invokeSafe(C.restartCore)
}

export async function mihomoUpdateProxyProviders(name: string): Promise<void> {
  return invokeSafe(C.mihomoUpdateProxyProviders, name)
}

export async function mihomoUpdateRuleProviders(name: string): Promise<void> {
  return invokeSafe(C.mihomoUpdateRuleProviders, name)
}

export async function mihomoProxyDelay(
  proxy: string,
  url?: string
): Promise<ControllerProxiesDelay> {
  return invokeSafe(C.mihomoProxyDelay, proxy, url)
}

export async function mihomoToggleRuleDisabled(data: Record<number, boolean>): Promise<void> {
  return invokeSafe(C.mihomoToggleRuleDisabled, data)
}

export async function checkMihomoLatestVersion(isAlpha: boolean): Promise<string | null> {
  return invokeSafe(C.checkMihomoLatestVersion, isAlpha)
}

export async function getControledMihomoConfig(force = false): Promise<Partial<MihomoConfig>> {
  return invokeSafe(C.getControledMihomoConfig, force)
}

export async function patchControledMihomoConfig(patch: Partial<MihomoConfig>): Promise<void> {
  return invokeSafe(C.patchControledMihomoConfig, patch)
}

export async function patchMihomoConfig(patch: Partial<MihomoConfig>): Promise<void> {
  return invokeSafe(C.patchMihomoConfig, patch)
}

export async function getRuntimeConfigStr(): Promise<string> {
  return invokeSafe(C.getRuntimeConfigStr)
}

export async function mihomoCloseAllConnections(name?: string): Promise<void> {
  return invokeSafe(C.mihomoCloseAllConnections, name)
}

export async function triggerSysProxy(
  enable: boolean,
  onlyActiveDevice: boolean
): Promise<void> {
  return invokeSafe(C.triggerSysProxy, enable, onlyActiveDevice)
}

export async function mihomoDnsQuery(
  name: string,
  type: string
): Promise<{ Answer?: { data: string }[] }> {
  return invokeSafe(C.mihomoDnsQuery, name, type)
}

export async function mihomoUpgradeGeo(): Promise<void> {
  return invokeSafe(C.mihomoUpgradeGeo)
}

export async function mihomoUpgradeUI(): Promise<void> {
  return invokeSafe(C.mihomoUpgradeUI)
}

export async function mihomoUpgrade(): Promise<void> {
  return invokeSafe(C.mihomoUpgrade)
}

export async function restartMihomoConnections(): Promise<void> {
  return invokeSafe(C.restartMihomoConnections)
}

export async function setupFirewall(): Promise<void> {
  return invokeSafe(C.setupFirewall)
}

export async function getInterfaces(): Promise<Record<string, NetworkInterfaceInfo[]>> {
  return invokeSafe(C.getInterfaces)
}

export async function startNetworkDetection(): Promise<void> {
  return invokeSafe(C.startNetworkDetection)
}

export async function stopNetworkDetection(): Promise<void> {
  return invokeSafe(C.stopNetworkDetection)
}
