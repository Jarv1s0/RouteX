import React, { useState } from 'react'
import { Card, CardBody } from '@heroui/react'
import { IoChevronForward } from 'react-icons/io5'

interface Props {
  title?: React.ReactNode
  children?: React.ReactNode
  className?: string
  collapsible?: boolean
  defaultCollapsed?: boolean
  isDisabled?: boolean
  forceExpanded?: boolean
}

const SettingCard: React.FC<Props> = (props) => {
  const { collapsible = false, defaultCollapsed = true, forceExpanded = false } = props
  const isDisabled = props.isDisabled ?? false
  const [collapsed, setCollapsed] = useState(collapsible && defaultCollapsed)
  const isCollapsed = collapsible && !forceExpanded && collapsed

  return (
    <Card className={`${props.className || ''} hover:shadow-md transition-shadow duration-200`}>
      <CardBody className="p-0">
        {props.title && (
          <div
            className={`px-4 py-3 text-sm font-bold flex justify-between items-center ${
              isDisabled ? 'text-default-300' : 'text-foreground'
            } ${collapsible ? 'cursor-pointer hover:bg-default-100' : ''}`}
            onClick={() => collapsible && setCollapsed(!collapsed)}
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-1 h-4 rounded-full ${isDisabled ? 'bg-default-300' : 'bg-primary'}`}
              />
              <span>{props.title}</span>
            </div>
            {collapsible && (
              <IoChevronForward
                className={`transition-transform duration-300 ease-out ${
                  isDisabled ? 'text-default-300' : ''
                } ${isCollapsed ? '' : 'rotate-90'}`}
              />
            )}
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
