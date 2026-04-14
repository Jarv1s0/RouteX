import { create } from 'zustand'
import { getAppConfig, patchAppConfig as patch } from '@renderer/api/app'
import merge from 'lodash/merge'

interface AppState {
  appConfig: AppConfig | undefined
  setAppConfig: (config: AppConfig) => void
  fetchAppConfig: () => Promise<void>
  patchAppConfig: (value: Partial<AppConfig>) => Promise<void>
  mutateAppConfig: () => void // Alias for fetchAppConfig to keep compatibility
}

export const useAppStore = create<AppState>((set, get) => ({
  appConfig: undefined,

  setAppConfig: (config) => {
    set({ appConfig: config })
  },

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
      const current = get().appConfig
      if (current) {
        set({ appConfig: merge({}, current, value) })
        return
      }
      void get().fetchAppConfig()
    } catch (e) {
      console.error('Failed to patch app config', e)
      void get().fetchAppConfig()
    }
  },

  mutateAppConfig: () => {
    get().fetchAppConfig()
  }
}))
