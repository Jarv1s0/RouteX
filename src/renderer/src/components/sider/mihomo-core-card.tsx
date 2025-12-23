import { Button, Card, CardBody, CardFooter, Tooltip } from '@heroui/react'
import { calcTraffic } from '@renderer/utils/calc'
import { mihomoVersion, restartCore, checkMihomoLatestVersion } from '@renderer/utils/ipc'
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
  const [latestVersion, setLatestVersion] = useState<string | null>(null)
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

  // 检查最新版本
  useEffect(() => {
    const checkLatest = async () => {
      const isAlpha = core === 'mihomo-alpha'
      const latest = await checkMihomoLatestVersion(isAlpha)
      setLatestVersion(latest)
    }
    checkLatest()
  }, [core])

  // 比较版本号，判断是否有新版本
  const hasNewVersion = (): boolean => {
    if (!version?.version || !latestVersion) return false
    const current = version.version.replace(/^v/, '')
    const latest = latestVersion.replace(/^v/, '')
    return current !== latest && latest > current
  }

  useEffect(() => {
    const token = PubSub.subscribe('mihomo-core-changed', () => {
      mutate()
    })
    window.electron.ipcRenderer.on('mihomoMemory', (_e, info: ControllerMemory) => {
      setMem(info.inuse)
    })
    window.electron.ipcRenderer.on('core-started', () => {
      mutate()
    })
    return (): void => {
      PubSub.unsubscribe(token)
      window.electron.ipcRenderer.removeAllListeners('mihomoMemory')
      window.electron.ipcRenderer.removeAllListeners('core-started')
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
            variant={match ? 'solid' : 'light'}
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
          className={`${match ? 'bg-primary' : 'hover:bg-primary/30 hover:-translate-y-0.5 hover:shadow-md'} transition-all duration-200 ${isDragging ? `${disableAnimation ? '' : 'scale-[0.95]'} tap-highlight-transparent` : ''}`}
        >
          <CardBody>
            <div
              ref={setNodeRef}
              {...attributes}
              {...listeners}
              className="flex justify-between h-[32px]"
            >
              <h3
                className={`text-md font-bold leading-[32px] ${match ? 'text-primary-foreground' : 'text-foreground'} `}
              >
                <span className="relative">
                  {version?.version ?? '-'}
                  {hasNewVersion() && (
                    <span className="absolute -top-1 -right-3 w-2.5 h-2.5 bg-pink-500 rounded-full" />
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
                    alert(e)
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
          className={`${match ? 'bg-primary' : 'hover:bg-primary/30 hover:-translate-y-0.5 hover:shadow-md'} transition-all duration-200 ${isDragging ? `${disableAnimation ? '' : 'scale-[0.95]'} tap-highlight-transparent` : ''}`}
        >
          <CardBody className="pb-1 pt-0 px-0 overflow-y-visible">
            <div className="flex justify-between">
              <Button
                isIconOnly
                className="bg-transparent pointer-events-none"
                variant="flat"
                color="default"
              >
                <LuCpu
                  color="default"
                  className={`${match ? 'text-primary-foreground' : 'text-foreground'} text-[24px]`}
                />
              </Button>
            </div>
          </CardBody>
          <CardFooter className="pt-1">
            <h3
              className={`text-md font-bold ${match ? 'text-primary-foreground' : 'text-foreground'}`}
            >
              内核设置
            </h3>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}

export default MihomoCoreCard
