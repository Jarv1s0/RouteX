import { Button, Tooltip } from '@heroui/react'
import { useLocation, useNavigate } from 'react-router-dom'
import SubStoreIcon from '../base/substore-icon'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import React from 'react'
import { CARD_STYLES } from '@renderer/utils/card-styles'

interface Props {
  iconOnly?: boolean
  isMinimal?: boolean
}

const SubStoreCard: React.FC<Props> = (props) => {
  const { appConfig } = useAppConfig()
  const { iconOnly, isMinimal } = props
  const { useSubStore = true } = appConfig || {}
  const location = useLocation()
  const navigate = useNavigate()
  const match = location.pathname.includes('/substore')

  if (!useSubStore) return null

  if (iconOnly) {
    return (
      <div className={`flex justify-center`}>
        <Tooltip content="Sub-Store" placement="right">
          <Button
            size="sm"
            isIconOnly
            color={match ? 'primary' : 'default'}
            variant={match ? 'solid' : 'light'}
            onPress={() => navigate('/substore')}
          >
            <SubStoreIcon className="text-[16px]" />
          </Button>
        </Tooltip>
      </div>
    )
  }

  if (isMinimal) {
    return (
      <Tooltip content="Sub-Store" placement="top">
        <div
          className={`flex items-center justify-center p-2 rounded-lg cursor-pointer transition-all ${
            match ? CARD_STYLES.SIDEBAR_ACTIVE : `${CARD_STYLES.SIDEBAR_ITEM} text-foreground/80`
          }`}
          onClick={() => navigate('/substore')}
        >
          <SubStoreIcon className={`text-[16px] text-default-500 dark:text-default-400`} />
        </div>
      </Tooltip>
    )
  }

  return (
    <div
      className={`substore-card flex items-center gap-1.5 px-3 py-1.5 rounded-xl cursor-pointer transition-all group ${
        match ? CARD_STYLES.SIDEBAR_ACTIVE : CARD_STYLES.SIDEBAR_ITEM
      }`}
      onClick={() => navigate('/substore')}
    >
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
        <SubStoreIcon className={`text-[16px] transition-colors text-default-500 dark:text-default-400 group-hover:text-primary`} />
      </span>
      <span className={`text-sm font-semibold transition-colors text-foreground/90 dark:text-foreground/80 group-hover:text-foreground`}>Sub-Store</span>
    </div>
  )
}

export default SubStoreCard
