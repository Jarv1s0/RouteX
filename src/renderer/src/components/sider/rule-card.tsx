import { Button, Card, CardBody, CardFooter, Tooltip } from '@heroui/react'
import { TbStack2 } from 'react-icons/tb'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import React, { useEffect, useMemo } from 'react'
import { mihomoRuleProviders } from '@renderer/utils/ipc'
import useSWR from 'swr'

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
  
  const { data, mutate } = useSWR('mihomoRuleProviders', mihomoRuleProviders, {
    errorRetryInterval: 200,
    errorRetryCount: 10,
    refreshInterval: 30000
  })
  
  const ruleCount = useMemo(() => {
    if (!data?.providers) return 0
    return Object.values(data.providers).reduce((total, provider) => total + (provider.ruleCount || 0), 0)
  }, [data])
  
  useEffect(() => {
    const handleRefresh = (): void => {
      mutate()
    }
    window.electron.ipcRenderer.on('core-started', handleRefresh)
    window.electron.ipcRenderer.on('rulesUpdated', handleRefresh)
    
    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('core-started')
      window.electron.ipcRenderer.removeAllListeners('rulesUpdated')
    }
  }, [mutate])
  
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
              <TbStack2
                className={`${match ? 'text-primary-foreground' : 'text-foreground'} text-[24px]`}
              />
            </Button>
          </div>
        </CardBody>
        <CardFooter className="pt-1 relative z-10">
          <div
            className={`flex justify-between w-full text-md font-bold ${match ? 'text-primary-foreground' : 'text-foreground'}`}
          >
            <h3>规则</h3>
            {ruleCount > 0 && <h3>{ruleCount.toLocaleString()}</h3>}
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

export default RuleCard
