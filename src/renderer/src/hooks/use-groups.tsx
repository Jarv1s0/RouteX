import React, { ReactNode } from 'react'
import { useGroupsStore } from '@renderer/store/use-groups-store'

// Backward compatibility: Provider is now a no-op fragment
export const GroupsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return <>{children}</>
}

// Hook now proxies to the store
export const useGroups = () => {
  const groups = useGroupsStore((state) => state.groups)
  const isLoading = useGroupsStore((state) => state.isLoading)
  const fetchGroups = useGroupsStore((state) => state.fetchGroups)

  return {
    groups,
    mutate: fetchGroups, // Alias for SWR mutate compatibility
    isLoading
  }
}
