import React, { useMemo } from 'react'

interface Props {
  value: number // 0-100
  isActive?: boolean // 是否选中状态
  className?: string
}

const TrafficProgress: React.FC<Props> = ({ value, isActive = false, className = '' }) => {
  // 根据使用量返回颜色
  const getColor = useMemo(() => {
    if (isActive) return 'bg-primary-foreground'
    if (value < 70) return 'bg-gradient-to-r from-green-400 to-green-500'
    if (value < 90) return 'bg-gradient-to-r from-yellow-400 to-orange-400'
    return 'bg-gradient-to-r from-orange-500 to-red-500'
  }, [value, isActive])

  return (
    <div className={`w-full h-1 bg-default-200 rounded-full overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full transition-all duration-500 ease-out ${getColor}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

export default TrafficProgress
