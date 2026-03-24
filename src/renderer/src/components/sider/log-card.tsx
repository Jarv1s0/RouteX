import { Button, Card, CardBody, CardFooter, Tooltip } from '@heroui/react'
import { LuFileText } from 'react-icons/lu'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import React from 'react'
import SiderCardIcon from '@renderer/components/base/sider-card-icon'

interface Props {
  iconOnly?: boolean
}

const LogCard: React.FC<Props> = (props) => {
  const { appConfig } = useAppConfig()
  const { iconOnly } = props
  const { logCardStatus = 'col-span-1', disableAnimation = false } = appConfig || {}
  const location = useLocation()
  const navigate = useNavigate()
  const match = location.pathname.includes('/logs')
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: 'log'
  })
  const transform = tf ? { x: tf.x, y: tf.y, scaleX: 1, scaleY: 1 } : null

  if (iconOnly) {
    return (
      <div className={`${logCardStatus} flex justify-center`}>
        <Tooltip content="日志" placement="right">
          <Button
            size="sm"
            isIconOnly
            color={match ? 'primary' : 'default'}
            variant={match ? 'solid' : 'light'}
            onPress={() => {
              navigate('/logs')
            }}
          >
            <LuFileText className="text-[18px]" />
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
      className={`${logCardStatus} log-card`}
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
            <SiderCardIcon isActive={match}>
              <LuFileText className="text-[18px]" />
            </SiderCardIcon>
          </div>
        </CardBody>
        <CardFooter className="pt-1 relative z-10">
          <h3
            className={`text-md font-bold ${match ? 'text-primary-foreground' : 'text-foreground'}`}
          >
            日志
          </h3>
        </CardFooter>
      </Card>
    </div>
  )
}

export default LogCard
