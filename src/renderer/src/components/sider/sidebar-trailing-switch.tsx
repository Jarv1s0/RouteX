import React from 'react'

import AppSwitch, { type AppSwitchProps } from '@renderer/components/base/app-switch'

const SidebarTrailingSwitch: React.FC<AppSwitchProps> = (props) => {
  const { size = 'sm', onKeyDown, ...switchProps } = props

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      className="shrink-0 flex items-center pr-0 -mr-0.5"
    >
      <AppSwitch
        size={size}
        onKeyDown={(event) => {
          event.stopPropagation()
          onKeyDown?.(event)
        }}
        {...switchProps}
      />
    </div>
  )
}

export default SidebarTrailingSwitch
