import { create } from 'zustand'
import { getAppConfig, patchAppConfig as patch } from '@renderer/api/app'
import merge from 'lodash/merge'

let fetchAppConfigPromise: Promise<AppConfig | undefined> | null = null

interface AppState {
  appConfig: AppConfig | undefined
  setAppConfig: (config: AppConfig) => void
  fetchAppConfig: () => Promise<AppConfig | undefined>
  patchAppConfig: (value: Partial<AppConfig>) => Promise<void>
  mutateAppConfig: () => void // Alias for fetchAppConfig to keep compatibility
}

export const useAppStore = create<AppState>((set, get) => ({
  appConfig: undefined,

  setAppConfig: (config) => {
    set({ appConfig: config })
  },

  fetchAppConfig: async () => {
    if (fetchAppConfigPromise) {
      return await fetchAppConfigPromise
    }

    fetchAppConfigPromise = getAppConfig()
      .then((config) => {
        set({ appConfig: config })
        return config
      })
      .catch((e) => {
        console.error('Failed to fetch app config', e)
        return undefined
      })
      .finally(() => {
        fetchAppConfigPromise = null
      })

    return await fetchAppConfigPromise
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
