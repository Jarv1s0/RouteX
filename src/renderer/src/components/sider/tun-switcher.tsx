import { Button, Card, CardBody, CardFooter, Tooltip } from '@heroui/react'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import BorderSwitch from '@renderer/components/base/border-swtich'
import { TbDeviceIpadHorizontalBolt } from 'react-icons/tb'
import { useLocation, useNavigate } from 'react-router-dom'
import { restartCore } from '@renderer/utils/ipc'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import React from 'react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { toast } from 'sonner'

interface Props {
  iconOnly?: boolean
}

const TunSwitcher: React.FC<Props> = (props) => {
  const { iconOnly } = props
  const location = useLocation()
  const navigate = useNavigate()
  const match = location.pathname.includes('/tun') || false
  const { appConfig } = useAppConfig()
  const { tunCardStatus = 'col-span-1', disableAnimation = false } = appConfig || {}
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { tun } = controledMihomoConfig || {}
  const { enable } = tun || {}
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: 'tun'
  })
  const transform = tf ? { x: tf.x, y: tf.y, scaleX: 1, scaleY: 1 } : null
  const onChange = async (enable: boolean): Promise<void> => {
    try {
      if (enable) {
        await patchControledMihomoConfig({ tun: { enable }, dns: { enable: true } })
      } else {
        await patchControledMihomoConfig({ tun: { enable } })
      }
      await restartCore()
      window.electron.ipcRenderer.send('updateFloatingWindow')
      window.electron.ipcRenderer.send('updateTrayMenu')
    } catch (error) {
      // 显示友好的错误提示
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      if (enable && (errorMessage.includes('permission') || errorMessage.includes('权限') || errorMessage.includes('access'))) {
        toast.error('TUN模式启动失败', {
          description: '请以管理员身份运行RouteX以使用TUN模式'
        })
      } else if (enable) {
        toast.error('TUN模式启动失败', {
          description: 'TUN模式需要管理员权限，请重新以管理员身份启动应用'
        })
      } else {
        toast.error('TUN模式关闭失败', {
          description: errorMessage
        })
      }
      
      console.error('TUN切换失败:', error)
    }
  }

  if (iconOnly) {
    return (
      <div className={`${tunCardStatus} flex justify-center`}>
        <Tooltip content="虚拟网卡" placement="right">
          <Button
            size="sm"
            isIconOnly
            color={match ? 'primary' : 'default'}
            variant={match ? 'solid' : 'light'}
            onPress={() => {
              navigate('/tun')
            }}
          >
            <TbDeviceIpadHorizontalBolt className="text-[20px]" />
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
      className={`${tunCardStatus} tun-card`}
    >
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
        radius="lg"
        shadow="none"
      >
        <CardBody className="pb-1 pt-0 px-0 relative z-10 overflow-visible">
          <div className="flex justify-between">
            <Button
              isIconOnly
              className="bg-transparent pointer-events-none"
              variant="light"
              color="default"
            >
              <TbDeviceIpadHorizontalBolt
                className={`text-[24px] ${match ? 'text-primary-foreground' : 'text-foreground'}`}
              />
            </Button>
            <BorderSwitch
              isShowBorder={match && enable}
              isSelected={enable}
              onValueChange={onChange}
            />
          </div>
        </CardBody>
        <CardFooter className="pt-1 relative z-10">
          <h3
             className={`text-md font-bold ${match ? 'text-primary-foreground' : 'text-foreground'}`}
          >
             虚拟网卡
          </h3>
        </CardFooter>
      </Card>
    </div>
  )
}

export default TunSwitcher
