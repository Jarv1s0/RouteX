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
    <Card className={`${props.className || ''} mb-4`}>
      <CardBody className="p-0">
        {props.title && (
          <div
            className={`px-4 py-2 text-sm font-medium text-default-500 flex justify-between items-center ${collapsible ? 'cursor-pointer hover:bg-default-100' : ''}`}
            onClick={() => collapsible && setCollapsed(!collapsed)}
          >
            <span>{props.title}</span>
            {collapsible && (
              <IoChevronForward
                className={`transition-transform duration-200 ${collapsed ? '' : 'rotate-90'}`}
              />
            )}
          </div>
        )}
        {!collapsed && <div className="px-4 pt-2 pb-2">{props.children}</div>}
      </CardBody>
    </Card>
  )
}

export default SettingCard
