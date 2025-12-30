import { Card, CardBody, Chip } from '@heroui/react'
import React from 'react'

const colorMap: Record<string, 'danger' | 'warning' | 'primary' | 'default'> = {
  error: 'danger',
  warning: 'warning',
  info: 'primary',
  debug: 'default'
}

interface Props extends ControllerLog {
  index: number
  onPress?: (log: ControllerLog & { time?: string }) => void
}

const LogItem: React.FC<Props> = (props) => {
  const { type, payload, time, index, onPress } = props

  const handlePress = () => {
    if (onPress) {
      onPress({ type, payload, time })
    }
  }

  return (
    <div className={`px-2 pb-2 ${index === 0 ? 'pt-2' : ''}`}>
      <Card 
        as="div"
        isPressable
        shadow="sm"
        radius="sm"
        className="bg-content2 hover:bg-primary/10 transition-colors"
        onPress={handlePress}
      >
        <CardBody className="py-2 px-3">
          <div className="flex items-center gap-2">
            <Chip
              size="sm"
              variant="flat"
              color={colorMap[type] || 'default'}
              classNames={{ content: "text-xs font-medium" }}
            >
              {type.toUpperCase()}
            </Chip>
            <span className="text-foreground-400 text-xs flex-shrink-0">
              {time}
            </span>
          </div>
          <div className="select-text text-sm mt-1 break-all line-clamp-2">
            {payload}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

export default LogItem
