import React, { ReactNode } from 'react'
import { useConnectionsStore } from '@renderer/store/use-connections-store'

// Backward compatibility: Provider is now a no-op fragment
export const ConnectionsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return <>{children}</>
}

// Hook now proxies to the store
export const useConnections = () => {
  const connections = useConnectionsStore((state) => state.connections)
  const connectionCount = useConnectionsStore((state) => state.connectionCount)
  const loading = useConnectionsStore((state) => state.loading)
  const memory = useConnectionsStore((state) => state.memory)

  return {
    connections,
    connectionCount,
    loading,
    memory
  }
}
