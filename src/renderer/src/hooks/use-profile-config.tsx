import React, { createContext, useContext, ReactNode, useEffect } from 'react'
import useSWR from 'swr'
import {
  getProfileConfig,
  setProfileConfig as set,
  addProfileItem as add,
  removeProfileItem as remove,
  updateProfileItem as update,
  changeCurrentProfile as change,
  setActiveProfiles as activate
} from '@renderer/utils/profile-ipc'
import { ON, SEND, onIpc, sendIpc } from '@renderer/utils/ipc-channels'
import { useI18n } from '@renderer/i18n'

interface ProfileConfigContextType {
  profileConfig: ProfileConfig | undefined
  setProfileConfig: (config: ProfileConfig) => Promise<boolean>
  mutateProfileConfig: () => void
  addProfileItem: (item: Partial<ProfileItem>) => Promise<boolean>
  updateProfileItem: (item: ProfileItem) => Promise<boolean>
  removeProfileItem: (id: string) => Promise<boolean>
  changeCurrentProfile: (id: string) => Promise<boolean>
  setActiveProfiles: (ids: string[], current?: string) => Promise<boolean>
}

const ProfileConfigContext = createContext<ProfileConfigContextType | undefined>(undefined)

export const ProfileConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t } = useI18n()
  const { data: profileConfig, mutate: mutateProfileConfig } = useSWR('getProfileConfig', () =>
    getProfileConfig()
  )

  const syncProfileConfig = React.useCallback((): void => {
    void mutateProfileConfig()
    sendIpc(SEND.updateTrayMenu)
  }, [mutateProfileConfig])

  const runProfileMutation = React.useCallback(
    async (action: () => Promise<void>, errorTitle: string): Promise<boolean> => {
      try {
        await action()
        return true
      } catch (e) {
        const { notifyError } = await import('@renderer/utils/notify')
        notifyError(e, { title: errorTitle })
        return false
      } finally {
        syncProfileConfig()
      }
    },
    [syncProfileConfig]
  )

  const setProfileConfig = React.useCallback(
    async (config: ProfileConfig): Promise<boolean> => {
      return runProfileMutation(() => set(config), t('profiles.saveConfigFailed'))
    },
    [runProfileMutation, t]
  )

  const addProfileItem = React.useCallback(
    async (item: Partial<ProfileItem>): Promise<boolean> => {
      return runProfileMutation(() => add(item), t('profiles.addFailed'))
    },
    [runProfileMutation, t]
  )

  const removeProfileItem = React.useCallback(
    async (id: string): Promise<boolean> => {
      return runProfileMutation(() => remove(id), t('profiles.deleteFailed'))
    },
    [runProfileMutation, t]
  )

  const updateProfileItem = React.useCallback(
    async (item: ProfileItem): Promise<boolean> => {
      return runProfileMutation(() => update(item), t('profiles.updateFailed'))
    },
    [runProfileMutation, t]
  )

  const changeCurrentProfile = React.useCallback(
    async (id: string): Promise<boolean> => {
      return runProfileMutation(() => change(id), t('profiles.changeFailed'))
    },
    [runProfileMutation, t]
  )

  const setActiveProfiles = React.useCallback(
    async (ids: string[], current?: string): Promise<boolean> => {
      return runProfileMutation(() => activate(ids, current), t('profiles.updateActiveFailed'))
    },
    [runProfileMutation, t]
  )

  useEffect(() => {
    const handleProfileConfigUpdated = (): void => {
      void mutateProfileConfig()
    }

    return onIpc(ON.profileConfigUpdated, handleProfileConfigUpdated)
  }, [mutateProfileConfig])

  const contextValue = React.useMemo(
    () => ({
      profileConfig,
      setProfileConfig,
      mutateProfileConfig: syncProfileConfig,
      addProfileItem,
      removeProfileItem,
      updateProfileItem,
      changeCurrentProfile,
      setActiveProfiles
    }),
    [
      addProfileItem,
      changeCurrentProfile,
      profileConfig,
      removeProfileItem,
      setActiveProfiles,
      setProfileConfig,
      syncProfileConfig,
      updateProfileItem
    ]
  )

  return (
    <ProfileConfigContext.Provider value={contextValue}>{children}</ProfileConfigContext.Provider>
  )
}

export const useProfileConfig = (): ProfileConfigContextType => {
  const context = useContext(ProfileConfigContext)
  if (context === undefined) {
    throw new Error('useProfileConfig must be used within a ProfileConfigProvider')
  }
  return context
}
