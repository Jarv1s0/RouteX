import { Avatar, Button, Card, Chip } from '@heroui/react'
import { calcTraffic } from '@renderer/utils/calc'
import dayjs from 'dayjs'
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { CgClose, CgTrash } from 'react-icons/cg'
import { IoEyeOff, IoEye } from 'react-icons/io5'

interface Props {
  index: number
  info: ControllerConnectionDetail
  displayIcon?: boolean
  iconUrl: string
  displayName?: string
  selected: ControllerConnectionDetail | undefined
  setSelected: React.Dispatch<React.SetStateAction<ControllerConnectionDetail | undefined>>
  setIsDetailModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  close: (id: string) => void
  hide?: (id: string) => void
  unhide?: (id: string) => void
  isHidden?: boolean
  timeRefreshTrigger?: number // 统一时间刷新触发器
}

const ConnectionItemComponent: React.FC<Props> = ({
  index: _index,
  info,
  displayIcon,
  iconUrl,
  displayName,
  close,
  hide,
  unhide,
  isHidden,
  selected,
  setSelected,
  setIsDetailModalOpen,
  timeRefreshTrigger
}) => {
  const fallbackProcessName = useMemo(
    () => info.metadata.process?.replace(/\.exe$/, '') || info.metadata.sourceIP,
    [info.metadata.process, info.metadata.sourceIP]
  )
  const processName = displayName || fallbackProcessName

  const destination = useMemo(
    () =>
      info.metadata.host ||
      info.metadata.sniffHost ||
      info.metadata.destinationIP ||
      info.metadata.remoteDestination,
    [
      info.metadata.host,
      info.metadata.sniffHost,
      info.metadata.destinationIP,
      info.metadata.remoteDestination
    ]
  )

  const [timeAgo, setTimeAgo] = useState(() => dayjs(info.start).fromNow())

  // 使用父组件的统一触发器更新时间，避免每个卡片独立定时器
  useEffect(() => {
    setTimeAgo(dayjs(info.start).fromNow())
  }, [info.start, timeRefreshTrigger])

  const uploadTraffic = useMemo(() => calcTraffic(info.upload), [info.upload])

  const downloadTraffic = useMemo(() => calcTraffic(info.download), [info.download])

  const uploadSpeed = useMemo(
    () => (info.uploadSpeed ? calcTraffic(info.uploadSpeed) : null),
    [info.uploadSpeed]
  )

  const downloadSpeed = useMemo(
    () => (info.downloadSpeed ? calcTraffic(info.downloadSpeed) : null),
    [info.downloadSpeed]
  )

  const hasSpeed = useMemo(
    () => Boolean(info.uploadSpeed || info.downloadSpeed),
    [info.uploadSpeed, info.downloadSpeed]
  )

  const handleCardPress = useCallback(() => {
    setSelected(info)
    setIsDetailModalOpen(true)
  }, [info, setSelected, setIsDetailModalOpen])

  const handleClose = useCallback(() => {
    close(info.id)
  }, [close, info.id])

  const handleHide = useCallback(() => {
    if (isHidden && unhide) {
      unhide(info.id)
    } else if (!isHidden && hide) {
      hide(info.id)
    }
  }, [hide, unhide, isHidden, info.id])

  return (
    <div className="px-2 pb-2">
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
    // Add missing deps
    prevProps.info.chains?.[0] === nextProps.info.chains?.[0] &&
    prevProps.info.rule === nextProps.info.rule
  )
})

export default ConnectionItem
