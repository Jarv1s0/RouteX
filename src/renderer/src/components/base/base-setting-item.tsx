import { Divider } from '@heroui/react'

import React from 'react'

interface Props {
  title: React.ReactNode
  actions?: React.ReactNode
  children?: React.ReactNode
  divider?: boolean
  onPress?: () => void
}

const SettingItem: React.FC<Props> = (props) => {
  const { title, actions, children, divider = false, onPress } = props

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (!onPress) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onPress()
    }
  }

  return (
    <>
      <div className="select-text w-full">
        <div
          className={`min-h-[30px] flex justify-between items-center pr-2 ${onPress ? 'cursor-pointer rounded-xl transition-colors hover:bg-default-100/60 px-2 -mx-2' : ''}`}
          role={onPress ? 'button' : undefined}
          tabIndex={onPress ? 0 : undefined}
          onClick={onPress}
          onKeyDown={handleKeyDown}
        >
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium leading-[32px] whitespace-nowrap">{title}</h4>
            <div>{actions}</div>
          </div>
          {children}
        </div>
        {divider && <Divider className="my-2 bg-default-200/50" />}
      </div>
    </>
  )
}

export default SettingItem
