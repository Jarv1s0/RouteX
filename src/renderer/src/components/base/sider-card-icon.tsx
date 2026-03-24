import React from 'react'

interface SiderCardIconProps {
  children: React.ReactNode
  className?: string
  isActive?: boolean
}

const SiderCardIcon: React.FC<SiderCardIconProps> = ({
  children,
  className = '',
  isActive = false
}) => {
  return (
    <div
      aria-hidden="true"
      className={`inline-flex h-8 w-8 items-center justify-center rounded-2xl pointer-events-none transition-all duration-300 ${
        isActive
          ? 'text-primary-foreground drop-shadow-[0_1px_8px_rgba(255,255,255,0.18)]'
          : 'text-foreground'
      } ${className}`.trim()}
    >
      {children}
    </div>
  )
}

export default SiderCardIcon
