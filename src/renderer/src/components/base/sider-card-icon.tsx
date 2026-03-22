import React from 'react'

interface SiderCardIconProps {
  children: React.ReactNode
  className?: string
}

const SiderCardIcon: React.FC<SiderCardIconProps> = ({ children, className = '' }) => {
  return (
    <div
      aria-hidden="true"
      className={`inline-flex h-8 w-8 items-center justify-center rounded-medium bg-transparent pointer-events-none ${className}`.trim()}
    >
      {children}
    </div>
  )
}

export default SiderCardIcon
