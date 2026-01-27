import { Card, CardBody } from '@heroui/react'
import React from 'react'


interface Props extends ControllerLog {
  index: number
  onPress?: (log: ControllerLog & { time?: string }) => void
}

const LogItem: React.FC<Props> = (props) => {
  const { type, payload, time, onPress } = props

  const handlePress = () => {
    if (onPress) {
      onPress({ type, payload, time })
    }
  }

  const borderColors: Record<string, string> = {
    error: 'bg-danger',
    warning: 'bg-warning',
    info: 'bg-primary',
    debug: 'bg-default'
  }

  return (
    <div className="px-2 pb-2">
      <Card 
        as="div"
        isPressable
        shadow="sm"
        radius="lg"
        className={`w-full transition-all duration-200 border group
          bg-white/60 dark:bg-[#18181b]/60 backdrop-blur-md 
          border-default-200/50 dark:border-white/5
          hover:bg-default-100/80 hover:shadow-md hover:scale-[1.002]
          data-[pressed=true]:scale-[0.98] data-[pressed=true]:bg-default-100/90
        `}
        onPress={handlePress}
      >
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${borderColors[type] || 'bg-default'} opacity-60 group-hover:opacity-100 transition-opacity`} />
        
        <CardBody className="py-2.5 px-3 pl-4">
          <div className="flex items-center justify-between mb-1.5">
             <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                    type === 'error' ? 'border-danger/30 text-danger bg-danger/10' :
                    type === 'warning' ? 'border-warning/30 text-warning bg-warning/10' :
                    type === 'info' ? 'border-primary/30 text-primary bg-primary/10' :
                    'border-default/30 text-default-500 bg-default/10'
                }`}>
                  {type.toUpperCase()}
                </span>
                <span className="text-default-400 text-[10px] font-mono tracking-tight">
                  {time}
                </span>
             </div>
          </div>
          <div className="select-text text-sm font-mono text-default-700 dark:text-default-300 break-all line-clamp-2 leading-relaxed">
            {payload}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

export default LogItem
