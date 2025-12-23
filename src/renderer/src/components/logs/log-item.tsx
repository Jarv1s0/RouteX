import { Card, CardBody, Chip } from '@heroui/react'
import React, { useState, useEffect, useRef } from 'react'

const colorMap: Record<string, 'danger' | 'warning' | 'primary' | 'default'> = {
  error: 'danger',
  warning: 'warning',
  info: 'primary',
  debug: 'default'
}

const LogItem: React.FC<ControllerLog & { index: number }> = (props) => {
  const { type, payload, time, index } = props
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleCopy = () => {
    const fullLog = `[${time}] [${type.toUpperCase()}] ${payload}`
    navigator.clipboard.writeText(fullLog)
    setMenuPos(null)
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setMenuPos({ x: e.clientX, y: e.clientY })
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuPos(null)
      }
    }
    if (menuPos) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuPos])

  return (
    <div className={`px-2 pb-1 ${index === 0 ? 'pt-2' : ''}`}>
      <Card 
        shadow="sm"
        className="border-1 border-divider hover:shadow-md hover:bg-primary/10 transition-all duration-200"
        onContextMenu={handleContextMenu}
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
          <div className="select-text text-sm mt-1 break-all">
            {payload}
          </div>
        </CardBody>
      </Card>
      
      {menuPos && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[100px] p-1 bg-default-100 rounded-lg shadow-md"
          style={{ left: menuPos.x, top: menuPos.y }}
        >
          <button
            className="w-full px-3 py-1.5 text-sm font-medium text-left rounded-md hover:bg-primary/20 transition-colors"
            onClick={handleCopy}
          >
            复制完整日志
          </button>
        </div>
      )}
    </div>
  )
}

export default LogItem
