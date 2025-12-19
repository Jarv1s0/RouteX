import { Button, Card, CardBody, CardFooter, Tooltip } from '@heroui/react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { LuGroup } from 'react-icons/lu'
import { useLocation, useNavigate } from 'react-router-dom'
import { useGroups } from '@renderer/hooks/use-groups'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { addFlag, removeFlag } from '@renderer/utils/flags'
import React, { useMemo } from 'react'

interface Props {
  iconOnly?: boolean
}

const ProxyCard: React.FC<Props> = (props) => {
  const { appConfig } = useAppConfig()
  const { iconOnly } = props
  const { proxyCardStatus = 'col-span-2', disableAnimation = false } = appConfig || {}
  const location = useLocation()
  const navigate = useNavigate()
  const match = location.pathname.includes('/proxies')
  const { groups = [] } = useGroups()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: 'proxy'
  })
  const transform = tf ? { x: tf.x, y: tf.y, scaleX: 1, scaleY: 1 } : null

  // 缓存第一个非GLOBAL组
  const firstGroup = useMemo(() => groups.find(g => g.name !== 'GLOBAL'), [groups])
  
  // 缓存当前选中的代理组名（带国旗）
  const currentGroupName = useMemo(() => {
    const groupName = firstGroup?.now
    return groupName ? addFlag(groupName) : '代理组'
  }, [firstGroup])

  // 缓存最终节点名（递归查找）
  const finalNodeName = useMemo(() => {
    const findFinalNode = (nodeName: string | undefined): string | undefined => {
      if (!nodeName) return undefined
      const subGroup = groups.find(g => g.name === nodeName)
      if (subGroup?.now) {
        return findFinalNode(subGroup.now)
      }
      return nodeName
    }
    const groupName = firstGroup?.now
    const finalNode = findFinalNode(groupName)
    if (groupName && finalNode && groupName !== finalNode) {
      return removeFlag(finalNode)
    }
    return ''
  }, [groups, firstGroup])

  if (iconOnly) {
    return (
      <div className={`${proxyCardStatus} flex justify-center`}>
        <Tooltip content="代理组" placement="right">
          <Button
            size="sm"
            isIconOnly
            color={match ? 'primary' : 'default'}
            variant={match ? 'solid' : 'light'}
            onPress={() => {
              navigate('/proxies')
            }}
          >
            <LuGroup className="text-[20px]" />
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
      className={`${proxyCardStatus} proxy-card`}
    >
      <Card
        fullWidth
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className={`${match ? 'bg-primary' : 'hover:bg-primary/30 hover:-translate-y-0.5 hover:shadow-md'} transition-all duration-200 ${isDragging ? `${disableAnimation ? '' : 'scale-[0.95]'} tap-highlight-transparent` : ''}`}
      >
        <CardBody>
          <div className="flex justify-between h-[32px]">
            <h3
              className={`text-md font-bold leading-[32px] flag-emoji ${match ? 'text-primary-foreground' : 'text-foreground'} truncate`}
            >
              {currentGroupName}
            </h3>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              className="pointer-events-none"
              color="default"
            >
              <LuGroup
                className={`text-[24px] ${match ? 'text-primary-foreground' : 'text-foreground'}`}
              />
            </Button>
          </div>
        </CardBody>
        <CardFooter className="pt-1">
          <div
            className={`flex justify-between w-full text-md font-bold ${match ? 'text-primary-foreground' : 'text-foreground'}`}
          >
            <h4 className={`text-xs ${match ? 'text-primary-foreground/70' : 'text-foreground-500'} truncate`}>
              {finalNodeName}
            </h4>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

export default ProxyCard
