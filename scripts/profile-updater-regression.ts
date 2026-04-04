import assert from 'node:assert/strict'
import { createScheduledProfileRefresher } from '../src/main/core/profileUpdater.shared.ts'

async function main(): Promise<void> {
  const staleItem: ProfileItem = {
    id: 'profile-1',
    type: 'remote',
    name: 'Remote Profile',
    url: 'https://example.com/sub.yaml',
    interval: 60,
    autoUpdate: true,
    updated: 1
  }
  const latestItem: ProfileItem = {
    ...staleItem,
    resetDay: 15,
    ua: 'RouteX-Test'
  }
  const savedItems: Partial<ProfileItem>[] = []
  const refreshScheduledProfile = createScheduledProfileRefresher({
    getProfileItem: async () => latestItem,
    addProfileItem: async (item) => {
      savedItems.push(item)
    }
  })

  const refreshedItem = await refreshScheduledProfile(staleItem.id)

  assert.equal(refreshedItem?.resetDay, 15)
  assert.equal(savedItems.length, 1)
  assert.deepEqual(savedItems[0], latestItem)
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
