import { cn, Switch as HeroSwitch, type SwitchProps } from '@heroui/react'
import React from 'react'

export type AppSwitchProps = SwitchProps

const AppSwitch: React.FC<AppSwitchProps> = ({ size = 'sm', classNames, ...props }) => {
  return (
    <HeroSwitch
      size={size}
      classNames={{
        ...classNames,
        wrapper: cn('!h-[18px] !min-w-[34px] !w-[34px]', classNames?.wrapper),
        thumb: cn(
          '!h-[14px] !w-[14px] !min-w-[14px] !max-w-[14px] !rounded-full !aspect-square !flex-none !translate-x-0 !-ml-[2px] group-data-[selected=true]:!ml-[14px]',
          classNames?.thumb
        )
      }}
      {...props}
    />
  )
}

export default AppSwitch
