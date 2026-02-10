import { Avatar, Button, Card, Chip } from '@heroui/react'
import { calcTraffic } from '@renderer/utils/calc'
import dayjs from 'dayjs'
import React, { memo, useCallback, useMemo } from 'react'
import { CgClose, CgTrash } from 'react-icons/cg'
import { IoEyeOff, IoEye } from 'react-icons/io5'

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

  const uploadTraffic = useMemo(() => calcTraffic(info.upload), [info.upload])
  const downloadTraffic = useMemo(() => calcTraffic(info.download), [info.download])
  const uploadSpeed = useMemo(() => calcTraffic(info.uploadSpeed || 0), [info.uploadSpeed])
  const downloadSpeed = useMemo(() => calcTraffic(info.downloadSpeed || 0), [info.downloadSpeed])
  const hasSpeed = (info.uploadSpeed || 0) > 0 || (info.downloadSpeed || 0) > 0

  const handleCardPress = useCallback(() => {
    setSelected?.(info)
    setIsDetailModalOpen?.(true)
  }, [setSelected, setIsDetailModalOpen, info])

  const handleClose = useCallback((e: any) => {
    e.stopPropagation?.()
    e.preventDefault?.()
    close?.(info.id)
  }, [close, info.id])

  const handleHide = useCallback((e: any) => {
    e.stopPropagation?.()
    e.preventDefault?.()
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
    <div className="px-2 pb-2" onContextMenu={handleContextMenu}>

      <Card
        as="div"
        isPressable
        shadow="sm"
        className={`w-full transition-all duration-200 border group
          ${
            info.id === selected?.id
            ? "bg-gradient-to-br from-default-100/90 to-default-50/90 backdrop-blur-2xl border-primary/30 shadow-[0_0_24px_rgba(var(--heroui-primary),0.12)] scale-[1.002] ring-1 ring-primary/20"
            : "bg-white/50 dark:bg-default-100/50 backdrop-blur-md border-transparent hover:border-default-200/50 hover:bg-white/80 dark:hover:bg-default-100/80 hover:scale-[1.002] hover:shadow-md"
          }
          data-[pressed=true]:scale-[0.98]
        `}
        radius="lg"
        onPress={handleCardPress}
      >
        <div className="w-full flex items-center p-3 gap-3">
          {displayIcon && (
            <Avatar
              size="md"
              radius="md"
              src={iconUrl}
              className="flex-shrink-0 bg-transparent"
            />
          )}
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <div className="flex items-center gap-2 pr-20 relative">
              <div className="flex-1 min-w-0 text-sm truncate">
                <span className="font-medium">{processName}</span>
                <span className="text-foreground-400"> → </span>
                <span>{destination}</span>
              </div>
              <small className="text-xs text-foreground-400 whitespace-nowrap">{timeAgo}</small>
              {(hide || unhide) && (
                <Button
                  color="default"
                  variant="light"
                  isIconOnly
                  size="sm"
                  className="absolute right-10"
                  onPress={handleHide}
                  title={isHidden ? '取消隐藏' : '隐藏连接'}
                >
                  {isHidden ? <IoEye className="text-base" /> : <IoEyeOff className="text-base" />}
                </Button>
              )}
              <Button
                color={info.isActive ? 'warning' : 'danger'}
                variant="light"
                isIconOnly
                size="sm"
                className="absolute right-2"
                onPress={handleClose}
              >
                {info.isActive ? <CgClose className="text-base" /> : <CgTrash className="text-base" />}
              </Button>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <Chip
                color={
                  !info.isActive ? 'danger' :
                  info.metadata.type === 'Inner' ? 'warning' :
                  info.metadata.type === 'Tun' ? 'primary' :
                  'default'
                }
                size="sm"
                radius="md"
                variant="flat"
                classNames={{ content: "text-xs" }}
              >
                {info.metadata.type}·{info.metadata.network.toUpperCase()}
              </Chip>
              <Chip
                className="flag-emoji"
                size="sm"
                radius="md"
                variant="flat"
                classNames={{ content: "text-xs" }}
                style={{ backgroundColor: 'rgba(5, 150, 105, 0.15)', color: 'rgb(5, 150, 105)' }}
              >
                {info.chains[0]}
              </Chip>
              <Chip 
                size="sm" 
                radius="md" 
                variant="flat"
              >
                <span className="text-xs" style={{ color: 'rgb(34, 211, 238)' }}>↑ {uploadTraffic}</span>
                <span className="text-xs"> </span>
                <span className="text-xs" style={{ color: 'rgb(192, 132, 252)' }}>↓ {downloadTraffic}</span>
              </Chip>
              {hasSpeed && (
                <Chip 
                  color="success" 
                  size="sm" 
                  radius="md" 
                  variant="flat"
                >
                  <span className="text-xs font-medium" style={{ color: 'rgb(34, 211, 238)' }}>↑ {uploadSpeed || '0 B'}/s</span>
                  <span className="text-xs font-medium"> </span>
                  <span className="text-xs font-medium" style={{ color: 'rgb(192, 132, 252)' }}>↓ {downloadSpeed || '0 B'}/s</span>
                </Chip>
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
    prevProps.info.upload === nextProps.info.upload &&
    prevProps.info.download === nextProps.info.download &&
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
