import React, { useState } from 'react'
import { Card, CardBody } from '@heroui/react'
import { IoChevronForward } from 'react-icons/io5'
import { CARD_STYLES } from '@renderer/utils/card-styles'

interface Props {
  title?: React.ReactNode
  children?: React.ReactNode
  className?: string
  collapsible?: boolean
  defaultCollapsed?: boolean
  isDisabled?: boolean
  forceExpanded?: boolean
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  description?: React.ReactNode
  headerActions?: React.ReactNode
}

const SettingCard: React.FC<Props> = (props) => {
  const { collapsible = false, defaultCollapsed = true, forceExpanded = false } = props
  const isDisabled = props.isDisabled ?? false
  const [collapsed, setCollapsed] = useState(collapsible && defaultCollapsed)
  const isCollapsed = collapsible && !forceExpanded && !(props.expanded ?? !collapsed)
  const toggleExpanded = (): void => {
    if (!collapsible) return
    if (props.expanded === undefined) setCollapsed(!collapsed)
    props.onExpandedChange?.(isCollapsed)
  }

  return (
    <Card
      className={`${CARD_STYLES.MANAGEMENT_CARD} ${CARD_STYLES.MANAGEMENT_NEUTRAL} ${props.className || ''}`}
    >
      <CardBody className="p-0">
        {props.title && (
          <div className="flex items-center">
            <div
              className={`px-4 py-3 text-sm font-bold flex justify-between items-center ${
                isDisabled ? 'text-default-300' : 'text-foreground'
              } ${collapsible ? 'cursor-pointer' : ''} min-w-0 flex-1 gap-3`}
              role={collapsible ? 'button' : undefined}
              tabIndex={collapsible ? 0 : undefined}
              aria-expanded={collapsible ? !isCollapsed : undefined}
              onClick={toggleExpanded}
              onKeyDown={(event) => {
                if (collapsible && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault()
                  toggleExpanded()
                }
              }}
            >
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                <div className="flex shrink-0 items-center gap-2">
                  <div
                    className={`w-1 h-4 rounded-full ${isDisabled ? 'bg-default-300' : 'bg-primary'}`}
                  />
                  <span className="font-bold">{props.title}</span>
                </div>
                {props.description && (
                  <span className="text-xs font-normal text-default-500">{props.description}</span>
                )}
              </div>
              {collapsible && (
                <IoChevronForward
                  className={`transition-transform duration-300 ease-out ${
                    isDisabled ? 'text-default-300' : ''
                  } ${isCollapsed ? '' : 'rotate-90'}`}
                />
              )}
            </div>
            {props.headerActions && <div className="shrink-0 pr-4">{props.headerActions}</div>}
          </div>
        )}
        {!isCollapsed && (
          <div className={`px-2 pb-2 ${props.title ? '' : 'pt-2'}`}>{props.children}</div>
        )}
      </CardBody>
    </Card>
  )
}

export default SettingCard
