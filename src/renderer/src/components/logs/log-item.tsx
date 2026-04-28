import { Card, CardBody } from '@heroui/react'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import React, { memo, useCallback } from 'react'


interface Props extends ControllerLog {
  index: number
  onPress?: (log: ControllerLog & { time?: string }) => void
}

const LogItem: React.FC<Props> = (props) => {
  const { type, payload, time, onPress } = props

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress({ type, payload, time })
    }
  }, [onPress, payload, time, type])

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
        shadow="none"
        radius="lg"
        className={`w-full group ${CARD_STYLES.BASE}
          bg-default-100/70 dark:bg-default-50/28
          border-default-200/60 dark:border-white/8
          hover:bg-default-100/85 dark:hover:bg-default-100/36 hover:border-default-300/50 dark:hover:border-white/12 hover:shadow
          data-[pressed=true]:scale-[0.995] data-[pressed=true]:bg-default-200/70 dark:data-[pressed=true]:bg-default-100/44
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

export default memo(LogItem, (prevProps, nextProps) => {
  return (
    prevProps.type === nextProps.type &&
    prevProps.payload === nextProps.payload &&
    prevProps.time === nextProps.time
  )
})
