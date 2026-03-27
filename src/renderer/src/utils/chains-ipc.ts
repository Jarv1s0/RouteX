import { C, invokeSafe } from './ipc-core'

export async function getChainsConfig(force = false): Promise<ChainsConfig> {
  return invokeSafe(C.getChainsConfig, force)
}

export async function getAllChains(): Promise<ChainItem[]> {
  return invokeSafe(C.getAllChains)
}

export async function addChainItem(item: Partial<ChainItem>): Promise<ChainItem> {
  return invokeSafe(C.addChainItem, item)
}

export async function updateChainItem(item: ChainItem): Promise<void> {
  return invokeSafe(C.updateChainItem, item)
}

export async function removeChainItem(id: string): Promise<void> {
  return invokeSafe(C.removeChainItem, id)
}
