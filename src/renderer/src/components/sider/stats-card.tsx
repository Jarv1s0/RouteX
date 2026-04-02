import { Button, Tooltip } from '@heroui/react'
import { LuChartColumn } from 'react-icons/lu'
import { useLocation, useNavigate } from 'react-router-dom'
import React from 'react'
import { CARD_STYLES } from '@renderer/utils/card-styles'

interface Props {
  iconOnly?: boolean
}

const StatsCard: React.FC<Props> = (props) => {
  const { iconOnly } = props
  const location = useLocation()
  const navigate = useNavigate()
  const match = location.pathname.includes('/stats')

  if (iconOnly) {
    return (
      <div className={`flex justify-center`}>
        <Tooltip content="统计" placement="right">
          <Button
            size="sm"
            isIconOnly
            color={match ? 'primary' : 'default'}
            variant={match ? 'solid' : 'light'}
            onPress={() => navigate('/stats')}
          >
            <LuChartColumn className="text-[17px]" />
          </Button>
        </Tooltip>
      </div>
    )
  }

  return (
    <div
      className={`stats-card flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer transition-all group ${
        match ? CARD_STYLES.SIDEBAR_ACTIVE : CARD_STYLES.SIDEBAR_ITEM
      }`}
      onClick={() => navigate('/stats')}
    >
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
        <LuChartColumn className={`text-[16px] transition-colors text-default-500 dark:text-default-400 group-hover:text-primary`} />
      </span>
      <span className={`text-sm font-medium transition-colors text-foreground/90 dark:text-foreground/80 group-hover:text-foreground`}>
        统计
      </span>
    </div>
  )
}

export default StatsCard
