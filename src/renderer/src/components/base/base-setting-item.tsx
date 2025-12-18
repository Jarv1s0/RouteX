import { Divider } from '@heroui/react'

import React from 'react'

interface Props {
  title: React.ReactNode
  actions?: React.ReactNode
  children?: React.ReactNode
  divider?: boolean
}

const SettingItem: React.FC<Props> = (props) => {
  const { title, actions, children, divider = false } = props

  return (
    <>
      <div className="select-text w-full">
        <div className="min-h-[30px] flex justify-between items-center pr-2">
          <div className="flex items-center">
            <h4 className="text-md leading-[32px] whitespace-nowrap">{title}</h4>
            <div>{actions}</div>
          </div>
          {children}
        </div>
        {divider && <Divider className="my-2" />}
      </div>
    </>
  )
}

export default SettingItem
