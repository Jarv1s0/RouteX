import React, { useState } from 'react'
import { Card, CardBody } from '@heroui/react'
import { IoChevronForward } from 'react-icons/io5'

interface Props {
  title?: string
  children?: React.ReactNode
  className?: string
  collapsible?: boolean
  defaultCollapsed?: boolean
}

const SettingCard: React.FC<Props> = (props) => {
  const { collapsible = false, defaultCollapsed = true } = props
  const [collapsed, setCollapsed] = useState(collapsible && defaultCollapsed)

  return (
    <Card className={`${props.className || ''} mb-2 hover:shadow-md transition-shadow duration-200`}>
      <CardBody className="p-0">
        {props.title && (
          <div
            className={`px-4 py-3 text-md font-bold text-foreground flex justify-between items-center ${collapsible ? 'cursor-pointer hover:bg-default-100' : ''}`}
            onClick={() => collapsible && setCollapsed(!collapsed)}
          >
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-primary rounded-full" />
              <span>{props.title}</span>
            </div>
            {collapsible && (
              <IoChevronForward
                className={`transition-transform duration-300 ease-out ${collapsed ? '' : 'rotate-90'}`}
              />
            )}
          </div>
        )}
        {!collapsed && <div className={`px-2 pb-2 ${props.title ? '' : 'pt-2'}`}>{props.children}</div>}
      </CardBody>
    </Card>
  )
}

export default SettingCard
