import { Button, Tooltip } from '@heroui/react'
import { calcTraffic } from '@renderer/utils/calc'
import {
  mihomoVersion,
  restartCore,
  checkMihomoLatestVersion,
  isExpectedMihomoUnavailableError
} from '@renderer/utils/mihomo-ipc'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { LuRotateCw, LuCpu } from 'react-icons/lu'
import { useLocation } from 'react-router-dom'
import PubSub from 'pubsub-js'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { ON, onIpc } from '@renderer/utils/ipc-channels'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { navigateSidebarRoute } from '@renderer/routes'

interface Props {
  iconOnly?: boolean
  compact?: boolean
  className?: string
}

async function showToastError(message: string): Promise<void> {
  const { toast } = await import('sonner')
  toast.error(message)
}

const MihomoCoreCard: React.FC<Props> = (props) => {
  const { appConfig } = useAppConfig()
  const { iconOnly, compact, className = '' } = props
  const { core = 'mihomo' } = appConfig || {}
  const [version, setVersion] = useState<ControllerVersion | null>(null)

  const location = useLocation()
  const match = location.pathname.includes('/mihomo')
  const handleNavigate = (): void => {
    navigateSidebarRoute('/mihomo')
  }

  const [mem, setMem] = useState(0)
  const [restarting, setRestarting] = useState(false)
  const [latestVersion, setLatestVersion] = useState<string | null>(null)
  const retryTimerRef = useRef<number | null>(null)
  const versionMountedRef = useRef(true)

  const clearRetryTimer = useCallback((): void => {
    if (retryTimerRef.current === null) {
      return
    }

    window.clearTimeout(retryTimerRef.current)
    retryTimerRef.current = null
  }, [])

  const refreshVersion = useCallback(async (): Promise<void> => {
    clearRetryTimer()
    try {
      const nextVersion = await mihomoVersion()
      if (versionMountedRef.current) {
        setVersion(nextVersion)
      }
    } catch (error) {
      if (!versionMountedRef.current) {
        return
      }

      if (isExpectedMihomoUnavailableError(error)) {
        if (retryTimerRef.current === null && !document.hidden) {
          retryTimerRef.current = window.setTimeout(() => {
            retryTimerRef.current = null
            void refreshVersion()
          }, 1200)
        }
      }
    }
  }, [clearRetryTimer])

  useEffect(() => {
    versionMountedRef.current = true
    void refreshVersion()
    return (): void => {
      versionMountedRef.current = false
      clearRetryTimer()
    }
  }, [clearRetryTimer, refreshVersion])

  useEffect(() => {
    if (!match) {
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const isAlpha = core === 'mihomo-alpha'
          const latest = await checkMihomoLatestVersion(isAlpha)
          if (!cancelled) {
            setLatestVersion(latest)
          }
        } catch {
          // ignore
        }
      })()
    }, 2500)

    return (): void => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [core, match])

  const hasNewVersion = (): boolean => {
    if (!version?.version || !latestVersion) return false
    if (core === 'mihomo-alpha') {
      return !version.version.includes(latestVersion)
    }
    const current = version.version.replace(/^v/, '')
    const latest = latestVersion.replace(/^v/, '')
    return current !== latest && latest > current
  }

  useEffect(() => {
    const token = PubSub.subscribe('mihomo-core-changed', () => void refreshVersion())
    const handleMemory = (_e: unknown, info: ControllerMemory): void => setMem(info.inuse)
    const handleCoreStarted = (): void => {
      void refreshVersion()
    }
    const handleVisibilityChange = (): void => {
      if (!document.hidden && !version) {
        void refreshVersion()
      }
    }

    const offMemory = onIpc(ON.mihomoMemory, handleMemory)
    const offCoreStarted = onIpc(ON.coreStarted, handleCoreStarted)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return (): void => {
      PubSub.unsubscribe(token)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      offMemory()
      offCoreStarted()
    }
  }, [refreshVersion, version])

  if (iconOnly) {
    return (
      <div className={`flex justify-center`}>
        <Tooltip content="内核设置" placement="right">
          <Button
            size="sm"
            isIconOnly
            color={match ? 'primary' : 'default'}
            variant="flat"
            onPress={handleNavigate}
          >
            <LuCpu className="text-[16px]" />
          </Button>
        </Tooltip>
      </div>
    )
  }

  return (
    <div
      className={`mihomo-core-card flex min-h-0 flex-col ${compact ? 'justify-between gap-1.5 px-3 py-2' : 'gap-1.5 p-2 px-3'} ${className} rounded-xl cursor-pointer transition-colors group ${
        match ? CARD_STYLES.SIDEBAR_ACTIVE : CARD_STYLES.SIDEBAR_ITEM
      }`}
      onClick={handleNavigate}
    >
      <div className="flex items-center justify-between h-7">
        <div className="flex items-center gap-1.5 flex-1">
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
            <LuCpu
              className={`text-[16px] transition-colors text-default-700 dark:text-default-300 group-hover:text-foreground`}
            />
          </span>
          <h3
            className={`${compact ? 'text-[13px]' : 'text-sm'} font-semibold transition-colors text-foreground dark:text-foreground/90 group-hover:text-foreground`}
          >
            内核设置
          </h3>
        </div>
        <div
          className="flex shrink-0 items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            isIconOnly
            size="sm"
            className={`${compact ? 'w-5 h-5' : 'w-6 h-6'} min-w-0`}
            variant="light"
            disabled={restarting}
            onPress={async () => {
              try {
                setRestarting(true)
                await restartCore()
                await new Promise((resolve) => setTimeout(resolve, 2000))
                setRestarting(false)
              } catch (e) {
                await showToastError(String(e))
              } finally {
                void refreshVersion()
              }
            }}
          >
            <LuRotateCw
              className={`${compact ? 'text-[13px]' : 'text-[14px]'} ${restarting ? 'animate-spin' : ''}`}
            />
          </Button>
        </div>
      </div>
      <div
        className={`flex justify-between items-center ${compact ? 'text-[10px]' : 'text-[11px]'} text-foreground/70 dark:text-foreground/65 px-0.5`}
      >
        <div className="flex items-center">
          {version?.version ?? '-'}
          {hasNewVersion() && (
            <Tooltip content={`新版本 ${latestVersion}`} placement="top">
              <span
                className={`inline-block ml-1.5 w-2 h-2 rounded-full animate-pulse align-middle bg-success`}
              />
            </Tooltip>
          )}
        </div>
        <span>{calcTraffic(mem)}</span>
      </div>
    </div>
  )
}

export default MihomoCoreCard
