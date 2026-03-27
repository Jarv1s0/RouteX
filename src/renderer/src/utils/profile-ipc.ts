import { C, invokeSafe } from './ipc-core'

export async function getProfileConfig(force = false): Promise<ProfileConfig> {
  return invokeSafe(C.getProfileConfig, force)
}

export async function setProfileConfig(config: ProfileConfig): Promise<void> {
  return invokeSafe(C.setProfileConfig, config)
}

export async function getCurrentProfileItem(): Promise<ProfileItem> {
  return invokeSafe(C.getCurrentProfileItem)
}

export async function getProfileItem(id: string | undefined): Promise<ProfileItem> {
  return invokeSafe(C.getProfileItem, id)
}

export async function changeCurrentProfile(id: string): Promise<void> {
  return invokeSafe(C.changeCurrentProfile, id)
}

export async function addProfileItem(item: Partial<ProfileItem>): Promise<void> {
  return invokeSafe(C.addProfileItem, item)
}

export async function removeProfileItem(id: string): Promise<void> {
  return invokeSafe(C.removeProfileItem, id)
}

export async function updateProfileItem(item: ProfileItem): Promise<void> {
  return invokeSafe(C.updateProfileItem, item)
}

export async function getProfileStr(id: string): Promise<string> {
  return invokeSafe(C.getProfileStr, id)
}

export async function setProfileStr(id: string, str: string): Promise<void> {
  return invokeSafe(C.setProfileStr, id, str)
}

export async function getRawProfileStr(): Promise<string> {
  return invokeSafe(C.getRawProfileStr)
}

export async function getCurrentProfileStr(): Promise<string> {
  return invokeSafe(C.getCurrentProfileStr)
}

export async function getGistUrl(): Promise<string> {
  return invokeSafe(C.getGistUrl)
}
