import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'

interface ConnectionsContextType {
  connections: ControllerConnectionDetail[]
  connectionCount: number
  loading: boolean
  memory: number
}

const ConnectionsContext = createContext<ConnectionsContextType | undefined>(undefined)

export const ConnectionsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [connections, setConnections] = useState<ControllerConnectionDetail[]>([])
  const [connectionCount, setConnectionCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [memory, setMemory] = useState(0)

  useEffect(() => {
    const handleConnections = (_e: unknown, info: ControllerConnections): void => {
      if (info && info.connections) {
        setConnections(info.connections)
        setConnectionCount(info.connections.length)
        setLoading(false)
      }
    }

    const handleMemory = (_e: unknown, info: ControllerMemory): void => {
      if (info && typeof info.inuse === 'number') {
        setMemory(info.inuse)
      }
    }

    // Bind once
    window.electron.ipcRenderer.on('mihomoConnections', handleConnections)
    window.electron.ipcRenderer.on('mihomoMemory', handleMemory)

    return (): void => {
      window.electron.ipcRenderer.removeListener('mihomoConnections', handleConnections)
      window.electron.ipcRenderer.removeListener('mihomoMemory', handleMemory)
    }
  }, []) // Empty dependency array ensures single subscription

  return (
    <ConnectionsContext.Provider value={{ connections, connectionCount, loading, memory }}>
      {children}
    </ConnectionsContext.Provider>
  )
}

export const useConnections = (): ConnectionsContextType => {
  const context = useContext(ConnectionsContext)
  if (context === undefined) {
    throw new Error('useConnections must be used within a ConnectionsProvider')
  }
  return context
}
