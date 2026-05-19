import React from 'react'
import { cn } from '@heroui/react'
import './border-switch.css'

import AppSwitch, { type AppSwitchProps } from '@renderer/components/base/app-switch'

interface SiderSwitchProps extends AppSwitchProps {
  isShowBorder?: boolean
}

const BorderSwitch: React.FC<SiderSwitchProps> = (props) => {
  const { isShowBorder = false, classNames, ...switchProps } = props

  return (
    <AppSwitch
      className="border-switch px-[8px]"
      classNames={{
        wrapper: cn('border-2', {
          'border-transparent': !isShowBorder,
          'border-primary-foreground': isShowBorder
        }),
        thumb: cn('absolute z-4', 'transform -translate-x-[2px]'),
        ...classNames
      }}
      size="sm"
      {...switchProps}
    />
  )
}

export default BorderSwitch
