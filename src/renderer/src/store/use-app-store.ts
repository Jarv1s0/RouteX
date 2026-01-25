import { create } from 'zustand'
import { getAppConfig, patchAppConfig as patch } from '@renderer/utils/ipc'

interface AppState {
  appConfig: AppConfig | undefined
  fetchAppConfig: () => Promise<void>
  patchAppConfig: (value: Partial<AppConfig>) => Promise<void>
  mutateAppConfig: () => void // Alias for fetchAppConfig to keep compatibility
}

export const useAppStore = create<AppState>((set, get) => ({
  appConfig: undefined,

  fetchAppConfig: async () => {
    try {
      const config = await getAppConfig()
      set({ appConfig: config })
    } catch (e) {
      console.error('Failed to fetch app config', e)
    }
  },

  patchAppConfig: async (value: Partial<AppConfig>) => {
    try {
      await patch(value)
      // Optimistic update or refetch? 
      // Current implementation in context did refetch.
      // We can do optimistic update first for speed.
      const current = get().appConfig
      if (current) {
        set({ appConfig: { ...current, ...value } })
      }
      // Then re-fetch to be sure (optional, but good for sync)
      get().fetchAppConfig()
    } catch (e) {
      console.error('Failed to patch app config', e)
      // Revert or just re-fetch
      get().fetchAppConfig()
    }
  },

  mutateAppConfig: () => {
    get().fetchAppConfig()
  }
}))


