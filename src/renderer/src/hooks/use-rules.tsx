import React, { createContext, useContext, ReactNode } from 'react'
import useSWR from 'swr'
import { mihomoRules } from '@renderer/utils/mihomo-ipc'
import { ON, onIpc } from '@renderer/utils/ipc-channels'

interface RulesContextType {
  rules: ControllerRules | undefined
  mutate: () => void
}

const RulesContext = createContext<RulesContextType | undefined>(undefined)
const RULE_REFRESH_DEBOUNCE_MS = 150
const RULES_UPDATED_REFRESH_DELAY_MS = 200

export const RulesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { data: rules, mutate } = useSWR<ControllerRules>('mihomoRules', mihomoRules, {
    errorRetryInterval: 200,
    errorRetryCount: 10,
    revalidateIfStale: false,
    revalidateOnMount: true
  })
  const refreshTimerRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    const clearRefreshTimer = (): void => {
      if (refreshTimerRef.current === null) {
        return
      }

      window.clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }

    const scheduleRefresh = (delay = RULE_REFRESH_DEBOUNCE_MS): void => {
      clearRefreshTimer()
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null
        void mutate()
      }, delay)
    }

    const handleRulesUpdated = (): void => {
      scheduleRefresh(RULES_UPDATED_REFRESH_DELAY_MS)
    }

    const handleCoreStarted = (): void => {
      scheduleRefresh()
    }

    const offRulesUpdated = onIpc(ON.rulesUpdated, handleRulesUpdated)
    const offCoreStarted = onIpc(ON.coreStarted, handleCoreStarted)

    return (): void => {
      clearRefreshTimer()
      offRulesUpdated()
      offCoreStarted()
    }
  }, [mutate])

  const contextValue = React.useMemo(() => ({ rules, mutate }), [rules, mutate])

  return <RulesContext.Provider value={contextValue}>{children}</RulesContext.Provider>
}

export const useRules = (): RulesContextType => {
  const context = useContext(RulesContext)
  if (context === undefined) {
    throw new Error('useRules must be used within an RulesProvider')
  }
  return context
}
