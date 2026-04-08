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

interface ProfileConfigContextType {
  profileConfig: ProfileConfig | undefined
  setProfileConfig: (config: ProfileConfig) => Promise<void>
  mutateProfileConfig: () => void
  addProfileItem: (item: Partial<ProfileItem>) => Promise<void>
  updateProfileItem: (item: ProfileItem) => Promise<void>
  removeProfileItem: (id: string) => Promise<void>
  changeCurrentProfile: (id: string) => Promise<void>
  setActiveProfiles: (ids: string[], current?: string) => Promise<void>
}

const ProfileConfigContext = createContext<ProfileConfigContextType | undefined>(undefined)

export const ProfileConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { data: profileConfig, mutate: mutateProfileConfig } = useSWR('getProfileConfig', () =>
    getProfileConfig()
  )

  const syncProfileConfig = React.useCallback((): void => {
    void mutateProfileConfig()
    sendIpc(SEND.updateTrayMenu)
  }, [mutateProfileConfig])

  const runProfileMutation = React.useCallback(
    async (action: () => Promise<void>, errorTitle: string): Promise<void> => {
      try {
        await action()
      } catch (e) {
        const { notifyError } = await import('@renderer/utils/notify')
        notifyError(e, { title: errorTitle })
      } finally {
        syncProfileConfig()
      }
    },
    [syncProfileConfig]
  )

  const setProfileConfig = React.useCallback(async (config: ProfileConfig): Promise<void> => {
    await runProfileMutation(() => set(config), '保存订阅配置失败')
  }, [runProfileMutation])

  const addProfileItem = React.useCallback(async (item: Partial<ProfileItem>): Promise<void> => {
    await runProfileMutation(() => add(item), '新增订阅失败')
  }, [runProfileMutation])

  const removeProfileItem = React.useCallback(async (id: string): Promise<void> => {
    await runProfileMutation(() => remove(id), '删除订阅失败')
  }, [runProfileMutation])

  const updateProfileItem = React.useCallback(async (item: ProfileItem): Promise<void> => {
    await runProfileMutation(() => update(item), '更新订阅失败')
  }, [runProfileMutation])

  const changeCurrentProfile = React.useCallback(async (id: string): Promise<void> => {
    await runProfileMutation(() => change(id), '切换订阅失败')
  }, [runProfileMutation])

  const setActiveProfiles = React.useCallback(async (ids: string[], current?: string): Promise<void> => {
    await runProfileMutation(() => activate(ids, current), '更新启用订阅失败')
  }, [runProfileMutation])

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
    <ProfileConfigContext.Provider value={contextValue}>
      {children}
    </ProfileConfigContext.Provider>
  )
}

export const useProfileConfig = (): ProfileConfigContextType => {
  const context = useContext(ProfileConfigContext)
  if (context === undefined) {
    throw new Error('useProfileConfig must be used within a ProfileConfigProvider')
  }
  return context
}
