import { Button, Tooltip } from '@heroui/react'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import React from 'react'
import { navigateSidebarRoute, preloadSidebarRoute } from '@renderer/routes'
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
  const handlePreload = (): void => {
    preloadSidebarRoute(path)
  }
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    event.preventDefault()
    handleNavigate()
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
            onFocus={handlePreload}
            onMouseEnter={handlePreload}
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
      className={`app-nodrag flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer group ${className} ${
        match ? CARD_STYLES.SIDEBAR_ACTIVE : CARD_STYLES.SIDEBAR_ITEM
      }`}
      onFocus={handlePreload}
      onClick={handleNavigate}
      onMouseEnter={handlePreload}
      onMouseDown={handlePreload}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
        <Icon
          className={`text-[16px] transition-all duration-150 ${
            match
              ? 'text-primary'
              : 'text-foreground/75 group-hover:text-primary group-hover:scale-110'
          }`}
        />
      </span>
      <span
        className={`text-sm font-medium transition-all duration-150 motion-reduce:transition-none ${
          match
            ? 'text-foreground'
            : 'text-foreground/90 group-hover:text-foreground group-hover:translate-x-0.5'
        }`}
      >
        {label}
      </span>
    </div>
  )
}

export default SidebarNavCard
