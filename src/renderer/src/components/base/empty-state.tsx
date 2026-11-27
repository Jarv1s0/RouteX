import React from 'react'

interface Props {
  icon: React.ReactNode
  title: string
  description?: string
}

const EmptyState: React.FC<Props> = ({ icon, title, description }) => {
  return (
    <div className="h-full w-full flex justify-center items-center">
      <div className="flex flex-col items-center gap-3 animate-fade-in-up">
        {/* 圆形发光背景，与应用玻璃拟态风格统一 */}
        <div className="relative flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-default-100/80 to-default-200/40 dark:from-default-100/20 dark:to-default-200/10 border border-default-200/50 dark:border-white/10 shadow-inner backdrop-blur-sm">
          {/* 外圈柔和光晕 */}
          <div className="absolute inset-0 rounded-full bg-primary/5 dark:bg-primary/10 blur-sm" />
          <div className="relative text-[40px] text-foreground/50">{icon}</div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <h3 className="text-base font-semibold text-foreground/80">{title}</h3>
          {description && <p className="text-sm text-foreground/65">{description}</p>}
        </div>
      </div>
    </div>
  )
}

export default EmptyState
