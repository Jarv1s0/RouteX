import { Button, Tooltip } from '@heroui/react'
import { useLocation, useNavigate } from 'react-router-dom'
import { LuWrench } from 'react-icons/lu'
import React from 'react'
import { CARD_STYLES } from '@renderer/utils/card-styles'

interface Props {
  iconOnly?: boolean
}

const ToolsCard: React.FC<Props> = (props) => {
  const { iconOnly } = props
  const navigate = useNavigate()
  const location = useLocation()
  const match = location.pathname.includes('/tools')

  if (iconOnly) {
    return (
      <div className={`flex justify-center`}>
        <Tooltip content="工具" placement="right">
          <Button
            size="sm"
            isIconOnly
            color={match ? 'primary' : 'default'}
            variant={match ? 'solid' : 'light'}
            onPress={() => navigate('/tools')}
          >
            <LuWrench className="text-[16px]" />
          </Button>
        </Tooltip>
      </div>
    )
  }

  return (
    <div
      className={`tools-card flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer transition-all group ${
        match ? CARD_STYLES.SIDEBAR_ACTIVE : CARD_STYLES.SIDEBAR_ITEM
      }`}
      onClick={() => navigate('/tools')}
    >
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
        <LuWrench className={`text-[16px] transition-colors text-default-500 dark:text-default-400 group-hover:text-primary`} />
      </span>
      <span className={`text-sm font-medium transition-colors text-foreground/90 dark:text-foreground/80 group-hover:text-foreground`}>
        工具
      </span>
    </div>
  )
}

export default ToolsCard
