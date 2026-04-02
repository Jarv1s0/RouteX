import { Button, Tooltip } from '@heroui/react'
import { LuFileText } from 'react-icons/lu'
import { useLocation, useNavigate } from 'react-router-dom'
import React from 'react'
import { CARD_STYLES } from '@renderer/utils/card-styles'

interface Props {
  iconOnly?: boolean
}

const LogCard: React.FC<Props> = (props) => {
  const { iconOnly } = props
  const navigate = useNavigate()
  const location = useLocation()
  const match = location.pathname.includes('/logs')

  if (iconOnly) {
    return (
      <div className={`flex justify-center`}>
        <Tooltip content="日志" placement="right">
          <Button
            size="sm"
            isIconOnly
            color={match ? 'primary' : 'default'}
            variant={match ? 'solid' : 'light'}
            onPress={() => navigate('/logs')}
          >
            <LuFileText className="text-[17px]" />
          </Button>
        </Tooltip>
      </div>
    )
  }

  return (
    <div
      className={`log-card flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer transition-all group ${
        match ? CARD_STYLES.SIDEBAR_ACTIVE : CARD_STYLES.SIDEBAR_ITEM
      }`}
      onClick={() => navigate('/logs')}
    >
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
        <LuFileText className={`text-[16px] transition-colors text-default-500 dark:text-default-400 group-hover:text-primary`} />
      </span>
      <span className={`text-sm font-medium transition-colors text-foreground/90 dark:text-foreground/80 group-hover:text-foreground`}>
        日志
      </span>
    </div>
  )
}

export default LogCard
