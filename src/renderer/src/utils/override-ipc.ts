import { C, invokeSafe } from './ipc-core'

export async function getOverrideConfig(force = false): Promise<OverrideConfig> {
  return invokeSafe(C.getOverrideConfig, force)
}

export async function setOverrideConfig(config: OverrideConfig): Promise<void> {
  return invokeSafe(C.setOverrideConfig, config)
}

export async function getOverrideItem(id: string): Promise<OverrideItem | undefined> {
  return invokeSafe(C.getOverrideItem, id)
}

export async function addOverrideItem(item: Partial<OverrideItem>): Promise<void> {
  return invokeSafe(C.addOverrideItem, item)
}

export async function removeOverrideItem(id: string): Promise<void> {
  return invokeSafe(C.removeOverrideItem, id)
}

export async function updateOverrideItem(item: OverrideItem): Promise<void> {
  return invokeSafe(C.updateOverrideItem, item)
}

export async function getOverride(id: string, ext: 'js' | 'yaml' | 'log'): Promise<string> {
  return invokeSafe(C.getOverride, id, ext)
}

export async function canRollbackOverride(id: string, ext: 'js' | 'yaml'): Promise<boolean> {
  return invokeSafe(C.canRollbackOverride, id, ext)
}

export async function rollbackOverride(id: string, ext: 'js' | 'yaml'): Promise<void> {
  return invokeSafe(C.rollbackOverride, id, ext)
}

export async function setOverride(id: string, ext: 'js' | 'yaml', str: string): Promise<void> {
  return invokeSafe(C.setOverride, id, ext, str)
}

export async function getOverrideProfileStr(): Promise<string> {
  return invokeSafe(C.getOverrideProfileStr)
}
