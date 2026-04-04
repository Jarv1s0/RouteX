import { addProfileItem, getCurrentProfileItem, getProfileConfig, getProfileItem } from '../config'
import { createScheduledProfileRefresher, isRefreshableProfileItem } from './profileUpdater.shared'

const intervalPool: Record<string, NodeJS.Timeout> = {}

function calculateUpdateDelay(item: ProfileItem): number {
  if (!item.interval) {
    return -1
  }

  const now = Date.now()
  const lastUpdated = item.updated || 0
  const intervalMs = item.interval * 60 * 1000
  const timeSinceLastUpdate = now - lastUpdated

  if (timeSinceLastUpdate >= intervalMs) {
    return 0
  }

  return intervalMs - timeSinceLastUpdate
}

const refreshScheduledProfile = createScheduledProfileRefresher({ addProfileItem, getProfileItem })

async function scheduleProfileUpdate(item: ProfileItem, isCurrent: boolean = false): Promise<void> {
  const latestItem = await getProfileItem(item.id)
  if (!isRefreshableProfileItem(latestItem)) {
    return
  }

  if (intervalPool[latestItem.id]) {
    clearTimeout(intervalPool[latestItem.id])
  }

  const delay = calculateUpdateDelay(latestItem)
  if (delay === -1) {
    return
  }

  const intervalMs = latestItem.interval * 60 * 1000
  const actualDelay = delay === 0 ? intervalMs : delay
  const finalDelay = isCurrent ? actualDelay + 10000 : actualDelay

  if (delay === 0) {
    try {
      await refreshScheduledProfile(latestItem.id)
      return
    } catch {
      // ignore
    }
  }

  intervalPool[latestItem.id] = setTimeout(async () => {
    try {
      await refreshScheduledProfile(latestItem.id)
    } catch {
      const nextItem = await getProfileItem(latestItem.id)
      if (nextItem) {
        const updatedItem = { ...nextItem, updated: Date.now() }
        await scheduleProfileUpdate(updatedItem, isCurrent)
      }
    }
  }, finalDelay)
}

export async function initProfileUpdater(): Promise<void> {
  const { items, current } = await getProfileConfig()
  const currentItem = await getCurrentProfileItem()

  for (const item of items.filter((i) => i.id !== current)) {
    await scheduleProfileUpdate(item, false)
  }

  if (currentItem) {
    await scheduleProfileUpdate(currentItem, true)
  }
}

export async function addProfileUpdater(item: ProfileItem): Promise<void> {
  await scheduleProfileUpdate(item, false)
}

export async function delProfileUpdater(id: string): Promise<void> {
  if (intervalPool[id]) {
    clearTimeout(intervalPool[id])
    delete intervalPool[id]
  }
}
