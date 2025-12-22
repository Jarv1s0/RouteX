import { Button, Card, CardBody, CardFooter, Tooltip } from '@heroui/react'
import { LuActivity } from 'react-icons/lu'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import React from 'react'

interface Props {
  iconOnly?: boolean
}

const StatsCard: React.FC<Props> = (props) => {
  const { appConfig } = useAppConfig()
  const { iconOnly } = props
  const { statsCardStatus = 'col-span-1', disableAnimation = false } = appConfig || {}
  const location = useLocation()
  const navigate = useNavigate()
  const match = location.pathname.includes('/stats')
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: 'stats'
  })
  const transform = tf ? { x: tf.x, y: tf.y, scaleX: 1, scaleY: 1 } : null

  if (iconOnly) {
    return (
      <div className={`${statsCardStatus} flex justify-center`}>
        <Tooltip content="统计" placement="right">
          <Button
            size="sm"
            isIconOnly
            color={match ? 'primary' : 'default'}
            variant={match ? 'solid' : 'light'}
            onPress={() => {
              navigate('/stats')
            }}
          >
            <LuActivity className="text-[20px]" />
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
      className={`${statsCardStatus} stats-card`}
    >
      <Card
        fullWidth
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className={`${match ? 'bg-primary' : 'hover:bg-primary/30 hover:-translate-y-0.5 hover:shadow-md'} transition-all duration-200 ${isDragging ? `${disableAnimation ? '' : 'scale-[0.95]'} tap-highlight-transparent` : ''}`}
        isPressable
        onPress={() => navigate('/stats')}
      >
        <CardBody className="pb-1 pt-0 px-0">
          <div className="flex justify-between">
            <Button
              isIconOnly
              className="bg-transparent pointer-events-none"
              variant="flat"
              color="default"
            >
              <LuActivity
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
            <h3>统计</h3>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

export default StatsCard
