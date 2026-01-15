import { addProfileItem, getCurrentProfileItem, getProfileConfig } from '../config'

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

async function scheduleProfileUpdate(item: ProfileItem, isCurrent: boolean = false): Promise<void> {
  if (item.type !== 'remote' || !item.interval || item.autoUpdate === false) {
    return
  }

  if (intervalPool[item.id]) {
    clearTimeout(intervalPool[item.id])
  }

  const delay = calculateUpdateDelay(item)
  if (delay === -1) {
    return
  }

  const intervalMs = item.interval * 60 * 1000
  const actualDelay = delay === 0 ? intervalMs : delay
  const finalDelay = isCurrent ? actualDelay + 10000 : actualDelay

  // 如果需要立即更新
  if (delay === 0) {
    try {
      await addProfileItem(item)
      return
    } catch (e) {
      // ignore
    }
  }

  // 设置下一次更新的定时器
  intervalPool[item.id] = setTimeout(async () => {
    try {
      await addProfileItem(item)
    } catch (e) {
      // ignore
      // 更新失败后重新调度下一次更新，避免死循环或任务丢失
      const updatedItem = { ...item, updated: Date.now() }
      await scheduleProfileUpdate(updatedItem, isCurrent)
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
