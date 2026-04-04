export type ScheduledProfileRefreshDeps = {
  addProfileItem: (item: Partial<ProfileItem>) => Promise<void>
  getProfileItem: (id: string | undefined) => Promise<ProfileItem | undefined>
}

export type RefreshableProfileItem = ProfileItem & {
  type: 'remote'
  interval: number
  autoUpdate?: boolean
}

export function isRefreshableProfileItem(
  item: ProfileItem | undefined
): item is RefreshableProfileItem {
  return !!item && item.type === 'remote' && !!item.interval && item.autoUpdate !== false
}

export function createScheduledProfileRefresher(
  deps: ScheduledProfileRefreshDeps
) {
  return async (id: string): Promise<ProfileItem | undefined> => {
    const latestItem = await deps.getProfileItem(id)
    if (!isRefreshableProfileItem(latestItem)) {
      return undefined
    }
    await deps.addProfileItem(latestItem)
    return latestItem
  }
}
