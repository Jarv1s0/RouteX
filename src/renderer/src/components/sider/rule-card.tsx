import { Button, Card, CardBody, CardFooter, Tooltip } from '@heroui/react'
import { TbStack2 } from 'react-icons/tb'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import React, { useEffect, useState } from 'react'
import { mihomoRuleProviders } from '@renderer/utils/ipc'

interface Props {
  iconOnly?: boolean
}

const RuleCard: React.FC<Props> = (props) => {
  const { appConfig } = useAppConfig()
  const { iconOnly } = props
  const { ruleCardStatus = 'col-span-1', disableAnimation = false } = appConfig || {}
  const location = useLocation()
  const navigate = useNavigate()
  const match = location.pathname.includes('/rules')
  const [ruleCount, setRuleCount] = useState(0)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: 'rule'
  })
  const transform = tf ? { x: tf.x, y: tf.y, scaleX: 1, scaleY: 1 } : null

  useEffect(() => {
    const fetchRules = async (): Promise<void> => {
      try {
        const data = await mihomoRuleProviders()
        let total = 0
        Object.values(data.providers || {}).forEach((provider) => {
          total += provider.ruleCount || 0
        })
        setRuleCount(total)
      } catch {
        // ignore
      }
    }
    fetchRules()
    
    const handleRulesUpdate = (): void => {
      fetchRules()
    }
    window.electron.ipcRenderer.on('rulesUpdated', handleRulesUpdate)
    
    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('rulesUpdated')
    }
  }, [])

  if (iconOnly) {
    return (
      <div className={`${ruleCardStatus} flex justify-center`}>
        <Tooltip content="规则" placement="right">
          <Button
            size="sm"
            isIconOnly
            color={match ? 'primary' : 'default'}
            variant={match ? 'solid' : 'light'}
            onPress={() => {
              navigate('/rules')
            }}
          >
            <TbStack2 className="text-[20px]" />
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
      className={`${ruleCardStatus} rule-card`}
    >
      <Card
        fullWidth
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className={`${match ? 'bg-primary' : 'hover:bg-primary/30 hover:-translate-y-0.5 hover:shadow-md'} transition-all duration-200 ${isDragging ? `${disableAnimation ? '' : 'scale-[0.95]'} tap-highlight-transparent` : ''}`}
      >
        <CardBody className="pb-1 pt-0 px-0">
          <div className="flex justify-between">
            <Button
              isIconOnly
              className="bg-transparent pointer-events-none"
              variant="flat"
              color="default"
            >
              <TbStack2
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
            <h3>规则</h3>
            {ruleCount > 0 && <h3>{ruleCount}</h3>}
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

export default RuleCard
