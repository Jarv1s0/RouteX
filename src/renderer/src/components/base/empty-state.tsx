import React from 'react'

interface Props {
  icon: React.ReactNode
  title: string
  description?: string
}

const EmptyState: React.FC<Props> = ({ icon, title, description }) => {
  return (
    <div className="h-full w-full flex justify-center items-center">
      <div className="flex flex-col items-center text-foreground-400">
        <div className="text-[64px] mb-4 opacity-50">{icon}</div>
        <h3 className="text-lg font-medium mb-1">{title}</h3>
        {description && <p className="text-sm opacity-70">{description}</p>}
      </div>
    </div>
  )
}

export default EmptyState
