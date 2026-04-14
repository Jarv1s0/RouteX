import { Button, Tooltip } from '@heroui/react'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import React from 'react'
import { navigateSidebarRoute } from '@renderer/routes'
import { useLocation } from 'react-router-dom'

export interface SidebarNavItemProps {
  iconOnly?: boolean
  className?: string
}

interface Props extends SidebarNavItemProps {
  iconOnly?: boolean
  label: string
  path: string
  icon: React.ComponentType<{ className?: string }>
  iconOnlySizeClass?: string
}

const SidebarNavCard: React.FC<Props> = ({
  iconOnly,
  label,
  path,
  icon: Icon,
  iconOnlySizeClass = 'text-[16px]',
  className = ''
}) => {
  const location = useLocation()
  const match = location.pathname.includes(path)
  const handleNavigate = (): void => {
    navigateSidebarRoute(path)
  }

  if (iconOnly) {
    return (
      <div className="flex justify-center">
        <Tooltip content={label} placement="right">
          <Button
            size="sm"
            isIconOnly
            color={match ? 'primary' : 'default'}
            variant={match ? 'solid' : 'light'}
            onPress={handleNavigate}
          >
            <Icon className={iconOnlySizeClass} />
          </Button>
        </Tooltip>
      </div>
    )
  }

  return (
      <div
      className={`app-nodrag flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer transition-colors group ${className} ${
        match ? CARD_STYLES.SIDEBAR_ACTIVE : CARD_STYLES.SIDEBAR_ITEM
      }`}
      onClick={handleNavigate}
    >
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
        <Icon className="text-[16px] transition-colors text-default-500 dark:text-default-400 group-hover:text-primary" />
      </span>
      <span className="text-sm font-medium transition-colors text-foreground/90 dark:text-foreground/80 group-hover:text-foreground">
        {label}
      </span>
    </div>
  )
}

export default SidebarNavCard
