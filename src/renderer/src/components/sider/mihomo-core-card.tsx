import { Button, Card, CardBody, CardFooter, Tooltip } from '@heroui/react'
import { calcTraffic } from '@renderer/utils/calc'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { mihomoVersion, restartCore, checkMihomoLatestVersion } from '@renderer/utils/ipc'
import { toast } from 'sonner'
import React, { useEffect, useState } from 'react'
import { IoMdRefresh } from 'react-icons/io'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useLocation, useNavigate } from 'react-router-dom'
import PubSub from 'pubsub-js'
import useSWR from 'swr'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { LuCpu } from 'react-icons/lu'

interface Props {
  iconOnly?: boolean
}

const MihomoCoreCard: React.FC<Props> = (props) => {
  const { appConfig } = useAppConfig()
  const { iconOnly } = props
  const { mihomoCoreCardStatus = 'col-span-2', disableAnimation = false, core = 'mihomo' } = appConfig || {}
  const { data: version, mutate } = useSWR('mihomoVersion', mihomoVersion, {
    errorRetryInterval: 200,
    errorRetryCount: 10
  })

  const location = useLocation()
  const navigate = useNavigate()
  const match = location.pathname.includes('/mihomo')
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: 'mihomo'
  })
  const transform = tf ? { x: tf.x, y: tf.y, scaleX: 1, scaleY: 1 } : null
  const [mem, setMem] = useState(0)
  const [restarting, setRestarting] = useState(false)
  const [latestVersion, setLatestVersion] = useState<string | null>(null)

  // 检查最新版本
  useEffect(() => {
    const checkLatest = async () => {
      try {
        const isAlpha = core === 'mihomo-alpha'
        const latest = await checkMihomoLatestVersion(isAlpha)
        setLatestVersion(latest)
      } catch {
        // 忽略错误
      }
    }
    checkLatest()
  }, [core])

  // 判断是否有新版本
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
    const token = PubSub.subscribe('mihomo-core-changed', () => {
      mutate()
    })
    const handleMemory = (_e: unknown, info: ControllerMemory): void => {
      setMem(info.inuse)
    }
    const handleCoreStarted = (): void => {
      mutate()
    }
    window.electron.ipcRenderer.on('mihomoMemory', handleMemory)
    window.electron.ipcRenderer.on('core-started', handleCoreStarted)
    return (): void => {
      PubSub.unsubscribe(token)
      window.electron.ipcRenderer.removeListener('mihomoMemory', handleMemory)
      window.electron.ipcRenderer.removeListener('core-started', handleCoreStarted)
    }
  }, [])

  if (iconOnly) {
    return (
      <div className={`${mihomoCoreCardStatus} flex justify-center`}>
        <Tooltip content="内核设置" placement="right">
          <Button
            size="sm"
            isIconOnly
            color={match ? 'primary' : 'default'}
            variant="flat"
            onPress={() => {
              navigate('/mihomo')
            }}
          >
            <LuCpu className="text-[20px]" />
          </Button>
        </Tooltip>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'relative',
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 'calc(infinity)' : undefined
      }}
      className={`${mihomoCoreCardStatus} mihomo-core-card`}
    >
        {mihomoCoreCardStatus === 'col-span-2' ? (
          <Card
            fullWidth
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            className={`
              ${CARD_STYLES.BASE}
              ${
                match
                  ? CARD_STYLES.ACTIVE
                  : CARD_STYLES.INACTIVE
              }
              ${isDragging ? `${disableAnimation ? '' : 'scale-[0.95]'} tap-highlight-transparent z-50` : ''}
              cursor-pointer
            `}
          >
            <CardBody>
            <div
              className="flex justify-between h-[32px]"
            >
              <h3
                className={`text-md font-bold leading-[32px] ${match ? 'text-primary-foreground' : 'text-foreground'} `}
              >
                <span className="relative">
                  {version?.version ?? '-'}
                  {hasNewVersion() && (
                    <Tooltip content={`新版本 ${latestVersion}`} placement="top">
                      <span className="absolute -top-0.5 -right-3 w-2 h-2 bg-success rounded-full animate-pulse" />
                    </Tooltip>
                  )}
                </span>
              </h3>

              <Button
                isIconOnly
                size="sm"
                variant="light"
                disabled={restarting}
                color="default"
                onPress={async () => {
                  try {
                    setRestarting(true)
                    await restartCore()
                    await new Promise((resolve) => setTimeout(resolve, 2000))
                    setRestarting(false)
                  } catch (e) {
                    toast.error(String(e))
                  } finally {
                    mutate()
                  }
                }}
              >
                <IoMdRefresh
                  className={`text-[24px] ${match ? 'text-primary-foreground' : 'text-foreground'} ${restarting ? 'animate-spin' : ''}`}
                />
              </Button>
            </div>
          </CardBody>
          <CardFooter className="pt-1">
            <div
              className={`flex justify-between w-full text-md font-bold ${match ? 'text-primary-foreground' : 'text-foreground'}`}
            >
              <h4>内核设置</h4>
              <h4>{calcTraffic(mem)}</h4>
            </div>
          </CardFooter>
          </Card>
        ) : (
          <Card
            fullWidth
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            className={`
              ${CARD_STYLES.BASE}
              ${
                match
                  ? CARD_STYLES.ACTIVE
                  : CARD_STYLES.INACTIVE
              }
              ${isDragging ? `${disableAnimation ? '' : 'scale-[0.95]'} tap-highlight-transparent z-50` : ''}
              cursor-pointer
            `}
          >
            <CardBody className="overflow-visible flex flex-col justify-between h-full">
              <div className="flex justify-between">
                 <Button
                   isIconOnly
                   size="sm"
                   className="bg-transparent pointer-events-none"
                   variant="light"
                   color="default"
                 >
                   <LuCpu
                     className={`text-[24px] ${match ? 'text-primary-foreground' : 'text-foreground'}`}
                   />
                 </Button>
              </div>
            </CardBody>
            <CardFooter className="pt-1">
                <h3 className={`text-md font-bold ${match ? 'text-primary-foreground' : 'text-foreground'}`}>
                  内核设置
                </h3>
            </CardFooter>
          </Card>
        )}
      </div>
  )
}

export default MihomoCoreCard
