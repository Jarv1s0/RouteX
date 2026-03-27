import { C, invokeSafe } from './ipc-core'

export async function startSubStoreFrontendServer(): Promise<void> {
  return invokeSafe(C.startSubStoreFrontendServer)
}

export async function stopSubStoreFrontendServer(): Promise<void> {
  return invokeSafe(C.stopSubStoreFrontendServer)
}

export async function startSubStoreBackendServer(): Promise<void> {
  return invokeSafe(C.startSubStoreBackendServer)
}

export async function stopSubStoreBackendServer(): Promise<void> {
  return invokeSafe(C.stopSubStoreBackendServer)
}

export async function downloadSubStore(): Promise<void> {
  return invokeSafe(C.downloadSubStore)
}

export async function subStorePort(): Promise<number> {
  return invokeSafe(C.subStorePort)
}

export async function subStoreFrontendPort(): Promise<number> {
  return invokeSafe(C.subStoreFrontendPort)
}

export async function subStoreSubs(): Promise<SubStoreSub[]> {
  return invokeSafe(C.subStoreSubs)
}

export async function subStoreCollections(): Promise<SubStoreSub[]> {
  return invokeSafe(C.subStoreCollections)
}
