import { Avatar, Button, Card } from '@heroui/react'
import { calcTraffic } from '@renderer/utils/calc'
import dayjs from 'dayjs'
import React, { memo, useCallback, useMemo } from 'react'
import type { PressEvent } from '@react-types/shared'
import { CgClose, CgTrash } from 'react-icons/cg'
import { IoEyeOff, IoEye, IoArrowUp, IoArrowDown } from 'react-icons/io5'
import { getFlag, cleanNodeName } from '@renderer/utils/flags'

interface Props {
  index: number
  info: ControllerConnectionDetail
  displayIcon?: boolean
  iconUrl?: string
  displayName?: string
  selected?: ControllerConnectionDetail
  setSelected?: React.Dispatch<React.SetStateAction<ControllerConnectionDetail | undefined>>
  setIsDetailModalOpen?: React.Dispatch<React.SetStateAction<boolean>>
  close?: (id: string) => void
  hide?: (id: string) => void
  unhide?: (id: string) => void
  isHidden?: boolean
  timeRefreshTrigger?: number
  onContextMenu?: (conn: ControllerConnectionDetail, event: React.MouseEvent) => void
}

const ConnectionItemComponent: React.FC<Props> = ({
  info,
  displayIcon,
  iconUrl,
  displayName,
  selected,
  setSelected,
  setIsDetailModalOpen,
  close,
  hide,
  unhide,
  isHidden,
  onContextMenu
}) => {
  const processName = displayName || info.metadata.process?.replace(/\.exe$/, '') || info.metadata.sourceIP || '-'
  const destination = info.metadata.host || info.metadata.destinationIP || info.metadata.remoteDestination || '-'
  
  const timeAgo = useMemo(() => {
    const seconds = dayjs().diff(dayjs(info.start), 'second')
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    return `${hours}h`
  }, [info.start])


  const uploadSpeed = useMemo(() => calcTraffic(info.uploadSpeed || 0), [info.uploadSpeed])
  const downloadSpeed = useMemo(() => calcTraffic(info.downloadSpeed || 0), [info.downloadSpeed])
  const hasSpeed = (info.uploadSpeed || 0) > 0 || (info.downloadSpeed || 0) > 0

  const handleCardPress = useCallback(() => {
    setSelected?.(info)
    setIsDetailModalOpen?.(true)
  }, [setSelected, setIsDetailModalOpen, info])

  const handleClose = useCallback((_e: PressEvent) => {
    close?.(info.id)
  }, [close, info.id])

  const handleHide = useCallback((_e: PressEvent) => {
    const id = info.id
    if (isHidden) {
      unhide?.(id)
    } else {
      hide?.(id)
    }
  }, [isHidden, hide, unhide, info.id])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    onContextMenu?.(info, e)
  }, [onContextMenu, info])

  return (
    <div className="px-2 pb-2.5" onContextMenu={handleContextMenu}>

      <Card
        as="div"
        isPressable
        shadow="sm"
        className={`w-full transition-all duration-300 border group
          ${
            info.id === selected?.id
            ? "bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 backdrop-blur-3xl border-primary/40 shadow-[0_4px_24px_-4px_rgba(var(--heroui-primary),0.3)] scale-[1.002] ring-1 ring-primary/30"
            : "bg-white/60 dark:bg-default-50/40 backdrop-blur-xl border-transparent hover:border-default-200/60 hover:bg-white/90 dark:hover:bg-default-100/60 hover:scale-[1.001] hover:shadow-lg"
          }
          data-[pressed=true]:scale-[0.99]
        `}
        radius="lg"
        onPress={handleCardPress}
      >
        <div className="w-full flex items-center py-2 px-3 gap-3">
          {displayIcon && (
            <Avatar
              size="sm"
              radius="none"
              src={iconUrl}
              className="flex-shrink-0 bg-transparent shadow-none border-none"
            />
          )}
          
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            {/* Header Row */}
            <div className="flex items-center justify-between w-full relative">
              <div className="flex-1 min-w-0 flex items-center gap-2 text-sm truncate mr-4">
                <span className="font-medium text-foreground-700 flex items-center gap-1.5">
                  {processName}
                  {isHidden && <IoEyeOff className="text-[12px] text-default-400" title="该连接已被隐藏" />}
                </span>
                <span className="text-foreground-300 text-[10px]">→</span>
                <span className="text-foreground-600 truncate">{destination}</span>
              </div>
              
              <div className="flex items-center justify-end shrink-0 relative h-6 w-[60px] group/actions">
                <span className={`font-mono text-[10px] text-foreground-400 font-medium bg-default-100/50 dark:bg-white/5 px-2 py-0.5 rounded-md transition-opacity ${isHidden ? 'opacity-0' : 'group-hover:opacity-0'}`}>
                  {timeAgo}
                </span>

                <div className={`absolute right-0 top-0 flex items-center justify-end gap-1 transition-all duration-200 ${isHidden ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'}`}>
                  {(hide || unhide) && (
                    <Button
                      color={isHidden ? 'primary' : 'default'}
                      variant={isHidden ? 'solid' : 'flat'}
                      isIconOnly
                      size="sm"
                      className={`h-6 w-6 min-w-[24px] transition-all ${isHidden ? 'shadow-lg shadow-primary/40' : 'bg-default-100 hover:bg-default-200 text-default-500'}`}
                      onPress={handleHide}
                      title={isHidden ? '取消隐藏' : '隐藏连接'}
                    >
                      {isHidden ? <IoEye className="text-[13px]" /> : <IoEyeOff className="text-[13px]" />}
                    </Button>
                  )}
                  <Button
                    color={info.isActive ? 'warning' : 'danger'}
                    variant="flat"
                    isIconOnly
                    size="sm"
                    className={`h-6 w-6 min-w-[24px] ${info.isActive ? 'bg-warning/10 text-warning hover:bg-warning/20' : 'bg-danger/10 text-danger hover:bg-danger/20'} ${isHidden ? 'hidden group-hover/actions:flex' : ''}`}
                    onPress={handleClose}
                  >
                    {info.isActive ? <CgClose className="text-[13px]" /> : <CgTrash className="text-[13px]" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* Meta Row - Contains Status, Node, and Speed */}
            <div className="flex items-center gap-2 flex-wrap relative">
              {/* Status Indicator */}
              <div className="flex items-center gap-1.5 bg-default-100/50 dark:bg-white/5 px-2 py-0.5 rounded-full border border-default-200/50">
                <span 
                  className={`w-1.5 h-1.5 rounded-full shadow-sm ${
                    !info.isActive ? 'bg-danger shadow-danger/50' :
                    info.metadata.type === 'Inner' ? 'bg-warning shadow-warning/50' :
                    info.metadata.type === 'Tun' ? 'bg-primary shadow-primary/50' :
                    'bg-default-400'
                  }`}
                />
                <span className="text-[10px] font-semibold tracking-wide text-foreground-600">
                  {info.metadata.type}·{info.metadata.network.toUpperCase()}
                </span>
              </div>

              {/* Node Badge */}
              <div
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-primary/20 bg-primary/[0.08] text-primary shadow-sm"
                style={{ filter: 'saturate(0.68)' }}
              >
                {getFlag(info.chains[0]) && (
                  <span className="flag-emoji text-[12px] leading-none">{getFlag(info.chains[0])}</span>
                )}
                <span className="text-[10px] font-semibold">{cleanNodeName(info.chains[0])}</span>
              </div>

              {/* Speed Indicators */}
              {hasSpeed && (
                <div className="flex items-center gap-2 bg-default-100/50 dark:bg-white/5 px-2 py-0.5 rounded-full border border-default-200/50 ml-1 shrink-0">
                  <div className="flex items-center gap-1 group/speed" style={{ color: 'rgb(14, 165, 233)' }}>
                    <IoArrowUp className="text-[10px] opacity-70 group-hover/speed:opacity-100 group-hover/speed:-translate-y-px transition-all" />
                    <span className="text-[10px] font-mono font-medium">{uploadSpeed || '0 B'}/s</span>
                  </div>
                  <div className="w-[1px] h-2 bg-default-200/50 dark:bg-white/10" />
                  <div className="flex items-center gap-1 group/speed" style={{ color: 'rgb(168, 85, 247)' }}>
                    <IoArrowDown className="text-[10px] opacity-70 group-hover/speed:opacity-100 group-hover/speed:translate-y-px transition-all" />
                    <span className="text-[10px] font-mono font-medium">{downloadSpeed || '0 B'}/s</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

const ConnectionItem = memo(ConnectionItemComponent, (prevProps, nextProps) => {
  return (
    prevProps.info.id === nextProps.info.id &&
    prevProps.info.uploadSpeed === nextProps.info.uploadSpeed &&
    prevProps.info.downloadSpeed === nextProps.info.downloadSpeed &&
    prevProps.info.isActive === nextProps.info.isActive &&
    prevProps.iconUrl === nextProps.iconUrl &&
    prevProps.displayIcon === nextProps.displayIcon &&
    prevProps.displayName === nextProps.displayName &&
    prevProps.selected?.id === nextProps.selected?.id &&
    prevProps.isHidden === nextProps.isHidden &&
    prevProps.timeRefreshTrigger === nextProps.timeRefreshTrigger &&
    prevProps.info.chains?.[0] === nextProps.info.chains?.[0] &&
    prevProps.info.rule === nextProps.info.rule
  )
})

export default ConnectionItem
