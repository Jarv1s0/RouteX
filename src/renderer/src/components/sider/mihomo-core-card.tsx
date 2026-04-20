import { Button, Tooltip } from '@heroui/react'
import { calcTraffic } from '@renderer/utils/calc'
import { mihomoVersion, restartCore } from '@renderer/utils/mihomo-ipc'
import React, { useEffect, useState } from 'react'
import { LuRotateCw, LuCpu } from 'react-icons/lu'
import { useLocation, useNavigate } from 'react-router-dom'
import PubSub from 'pubsub-js'
import useSWR from 'swr'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { ON, onIpc } from '@renderer/utils/ipc-channels'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { useMihomoCoreUpdateStatus } from '@renderer/hooks/use-mihomo-core-update-status'

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
  const { data: version, mutate } = useSWR('mihomoVersion', mihomoVersion, {
    errorRetryInterval: 200,
    errorRetryCount: 10
  })

  const location = useLocation()
  const navigate = useNavigate()
  const match = location.pathname.includes('/mihomo')

  const [mem, setMem] = useState(0)
  const [restarting, setRestarting] = useState(false)
  const { latestVersion, hasNewVersion } = useMihomoCoreUpdateStatus(core, version?.version)

  useEffect(() => {
    const token = PubSub.subscribe('mihomo-core-changed', () => mutate())
    const handleMemory = (_e: unknown, info: ControllerMemory): void => setMem(info.inuse)
    const handleCoreStarted = (): void => {
      void mutate()
    }

    const offMemory = onIpc(ON.mihomoMemory, handleMemory)
    const offCoreStarted = onIpc(ON.coreStarted, handleCoreStarted)
    return (): void => {
      PubSub.unsubscribe(token)
      offMemory()
      offCoreStarted()
    }
  }, [])

  if (iconOnly) {
    return (
      <div className={`flex justify-center`}>
        <Tooltip content="内核设置" placement="right">
          <div className="relative">
            <Button
              size="sm"
              isIconOnly
              color={match ? 'primary' : 'default'}
              variant="flat"
              onPress={() => navigate('/mihomo')}
            >
              <LuCpu className="text-[16px]" />
            </Button>
            {hasNewVersion && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-success ring-2 ring-background" />
            )}
          </div>
        </Tooltip>
      </div>
    )
  }

  return (
    <div
      className={`mihomo-core-card flex min-h-0 flex-col ${compact ? 'justify-between gap-1.5 px-3 py-2' : 'gap-1.5 p-2 px-3'} ${className} rounded-xl cursor-pointer transition-all group ${
        match ? CARD_STYLES.SIDEBAR_ACTIVE : CARD_STYLES.SIDEBAR_ITEM
      }`}
      onClick={() => navigate('/mihomo')}
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
                mutate()
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
          {hasNewVersion && (
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
