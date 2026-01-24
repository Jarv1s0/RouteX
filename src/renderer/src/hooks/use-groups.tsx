import React, { createContext, useContext, ReactNode, useRef, useEffect } from 'react'
import useSWR from 'swr'
import { mihomoGroups, mihomoGroupDelay } from '@renderer/utils/ipc'

interface GroupsContextType {
  groups: ControllerMixedGroup[] | undefined
  mutate: () => void
  isLoading: boolean
}

const GroupsContext = createContext<GroupsContextType | undefined>(undefined)

export const GroupsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { data: groups, mutate, isLoading } = useSWR<ControllerMixedGroup[]>('mihomoGroups', mihomoGroups, {
    errorRetryInterval: 200,
    errorRetryCount: 10,
    refreshInterval: 10000 // 每10秒刷新一次代理数据
  })

  useEffect(() => {
    window.electron.ipcRenderer.on('groupsUpdated', () => {
      mutate()
    })
    window.electron.ipcRenderer.on('core-started', () => {
      mutate()
    })
    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('groupsUpdated')
      window.electron.ipcRenderer.removeAllListeners('core-started')
    }
  }, [])

  // 启动时静默测速一次，确保进入代理页面时有数据
  const hasInitialTestRun = useRef(false)
  useEffect(() => {
    if (!groups || groups.length === 0 || hasInitialTestRun.current) return
    hasInitialTestRun.current = true

    const promises = groups.map((g) => mihomoGroupDelay(g.name, g.testUrl).catch(() => {}))
    Promise.allSettled(promises).then(() => mutate())
  }, [groups, mutate])

  return <GroupsContext.Provider value={{ groups, mutate, isLoading }}>{children}</GroupsContext.Provider>
}

export const useGroups = (): GroupsContextType => {
  const context = useContext(GroupsContext)
  if (context === undefined) {
    throw new Error('useGroups must be used within an GroupsProvider')
  }
  return context
}
