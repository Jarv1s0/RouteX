import { Button, Card, CardBody, CardFooter, Tooltip } from '@heroui/react'
import { useLocation, useNavigate } from 'react-router-dom'
import { LuWrench } from 'react-icons/lu'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import React from 'react'

interface Props {
  iconOnly?: boolean
}

const ToolsCard: React.FC<Props> = (props) => {
  const { appConfig } = useAppConfig()
  const { iconOnly } = props
  const { toolsCardStatus = 'col-span-1', disableAnimation = false } = appConfig || {}
  const navigate = useNavigate()
  const location = useLocation()
  const match = location.pathname.includes('/tools')
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: 'tools'
  })
  const transform = tf ? { x: tf.x, y: tf.y, scaleX: 1, scaleY: 1 } : null

  if (iconOnly) {
    return (
      <div className={`${toolsCardStatus} flex justify-center`}>
        <Tooltip content="工具" placement="right">
          <Button
            size="sm"
            isIconOnly
            color={match ? 'primary' : 'default'}
            variant={match ? 'solid' : 'light'}
            onPress={() => navigate('/tools')}
          >
            <LuWrench className="text-[20px]" />
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
      className={`${toolsCardStatus} tools-card`}
    >
      <Card
        fullWidth
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className={`${match ? 'bg-primary' : 'hover:bg-primary/30 hover:-translate-y-0.5 hover:shadow-md'} transition-all duration-200 ${isDragging ? `${disableAnimation ? '' : 'scale-[0.95]'} tap-highlight-transparent` : ''}`}
        isPressable
        onPress={() => navigate('/tools')}
      >
        <CardBody className="pb-1 pt-0 px-0">
          <div className="flex justify-between">
            <Button
              isIconOnly
              className="bg-transparent pointer-events-none"
              variant="flat"
              color="default"
            >
              <LuWrench
                color="default"
                className={`${match ? 'text-primary-foreground' : 'text-foreground'} text-[24px]`}
              />
            </Button>
          </div>
        </CardBody>
        <CardFooter className="pt-1">
          <div
            className={`flex justify-between w-full text-md font-bold ${match ? 'text-primary-foreground' : 'text-foreground'}`}
          >
            <h3>工具</h3>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

export default ToolsCard
