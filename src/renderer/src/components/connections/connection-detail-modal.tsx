import { Modal, ModalContent, ModalHeader, ModalBody, Button, Chip, ScrollShadow } from '@heroui/react'
import React, { useMemo } from 'react'
import { calcTraffic } from '@renderer/utils/calc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useGroups } from '@renderer/hooks/use-groups'
import { IoClose, IoServer, IoEarth, IoShieldCheckmark, IoTime, IoCodeSlash, IoPerson, IoArrowForward } from 'react-icons/io5'
import { MdTimeline } from 'react-icons/md'
import { FaGlobeAmericas, FaNetworkWired } from 'react-icons/fa'
import { clsx } from 'clsx'
import dayjs from 'dayjs'

interface Props {
  connection: ControllerConnectionDetail
  onClose: () => void
}

const ConnectionDetailModal: React.FC<Props> = (props) => {
  const { connection, onClose } = props
  const { appConfig: { disableAnimation = false, delayThresholds = { good: 200, fair: 500 } } = {} } = useAppConfig()
  const { groups = [] } = useGroups()

  // 辅助函数：获取延迟颜色
  const getDelayColorClass = (delay: number) => {
    if (delay === 0) return 'text-danger'
    if (delay < delayThresholds.good) return 'text-success'
    if (delay < delayThresholds.fair) return 'text-warning'
    return 'text-danger'
  }

  // 查找代理链中的组信息
  const chainGroups = useMemo(() => {
    return connection.chains.map((chainName, index) => {
      const group = groups.find(g => g.name === chainName)
      return { name: chainName, group, isLast: index === connection.chains.length - 1 }
    }).reverse()
  }, [connection.chains, groups])

  // 格式化 IP 和 端口
  const source = `${connection.metadata.sourceIP}:${connection.metadata.sourcePort}`
  const destination = connection.metadata.host 
    ? `${connection.metadata.host}:${connection.metadata.destinationPort}`
    : `${connection.metadata.destinationIP}:${connection.metadata.destinationPort}`

  const processName = connection.metadata.process || 'Unknown Process'
  const processPath = connection.metadata.processPath

  return (
    <Modal
      backdrop={disableAnimation ? 'transparent' : 'blur'}
      disableAnimation={disableAnimation}
      classNames={{ 
        backdrop: 'bg-black/60 backdrop-blur-sm',
        wrapper: 'z-[9999]',
        base: 'bg-content1 dark:bg-content1 border border-divider shadow-xl max-h-[90vh]'
      }}
      size="4xl"
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      motionProps={{
        variants: {
          enter: { scale: 1, opacity: 1, transition: { duration: 0.2, ease: "easeOut" } },
          exit: { scale: 0.98, opacity: 0, transition: { duration: 0.15, ease: "easeIn" } },
        }
      }}
    >
      <ModalContent className="flag-emoji">
        {/* Header */}
        <ModalHeader className="flex flex-col gap-0 p-0 border-b border-divider">
          {/* 顶部标题栏 */}
          <div className="flex justify-between items-center px-6 py-4">
            <div className="flex items-center gap-4">
              {/* 进程图标 */}
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                {localStorage.getItem(processPath || '') ? (
                  <img
                    src={localStorage.getItem(processPath || '') || ''}
                    className="w-8 h-8 object-contain"
                    alt=""
                  />
                ) : (
                  <FaGlobeAmericas className="text-2xl text-primary" />
                )}
              </div>
              
              {/* 标题和标签 */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-foreground">{processName}</h2>
                  <Chip size="sm" variant="flat" color="primary" className="h-5">
                    {connection.metadata.network.toUpperCase()}
                  </Chip>
                  <Chip size="sm" variant="flat" className="h-5 bg-default-100 text-default-600">
                    {connection.metadata.type}
                  </Chip>
                </div>
              </div>
            </div>

            <Button
              isIconOnly
              size="sm"
              variant="light"
              className="text-default-500 hover:text-foreground"
              onPress={onClose}
            >
              <IoClose className="text-xl" />
            </Button>
          </div>
          
          {/* 流量统计条 */}
          <div className="grid grid-cols-2 gap-4 px-6 py-4 bg-default-50 dark:bg-default-100/30">
            {/* 下载 */}
            <div className="flex items-center gap-4 p-3 rounded-xl bg-content1 border border-divider">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <span className="text-success text-lg">↓</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-default-500 uppercase">下载</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-mono font-bold text-foreground">{calcTraffic(connection.download)}</span>
                  <span className="text-xs font-mono text-success">{calcTraffic(connection.downloadSpeed || 0)}/s</span>
                </div>
              </div>
            </div>
            
            {/* 上传 */}
            <div className="flex items-center gap-4 p-3 rounded-xl bg-content1 border border-divider">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-primary text-lg">↑</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-default-500 uppercase">上传</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-mono font-bold text-foreground">{calcTraffic(connection.upload)}</span>
                  <span className="text-xs font-mono text-primary">{calcTraffic(connection.uploadSpeed || 0)}/s</span>
                </div>
              </div>
            </div>
          </div>
        </ModalHeader>

        <ModalBody className="p-0 flex flex-row overflow-hidden">
          
          {/* 左侧：连接信息 */}
          <ScrollShadow className="flex-1 p-5 flex flex-col gap-4 max-h-[500px] overflow-y-auto">
            
            {/* 源地址和目标地址 */}
            <div className="grid grid-cols-2 gap-3">
              <InfoCard 
                icon={<IoPerson />} 
                label="源地址" 
                value={source} 
                subValue={connection.metadata.sourceGeoIP?.join(' ') || '本地网络'}
              />
              <InfoCard 
                icon={<FaNetworkWired />} 
                label="目标地址" 
                value={destination} 
                subValue={connection.metadata.destinationGeoIP ? `${connection.metadata.destinationGeoIP} ${connection.metadata.destinationIPASN || ''}` : connection.metadata.host ? '解析中' : '直连'}
                highlight
              />
            </div>
            
            {/* 规则和 DNS */}
            <div className="grid grid-cols-2 gap-3">
              <InfoCard 
                icon={<IoShieldCheckmark />} 
                label="匹配规则" 
                value={connection.rulePayload || connection.rule} 
                subValue={connection.rulePayload ? connection.rule : undefined}
                accent="warning"
              />
              <InfoCard 
                icon={<IoEarth />} 
                label="DNS 模式" 
                value={connection.metadata.dnsMode} 
                subValue={connection.metadata.sniffHost ? `嗅探: ${connection.metadata.sniffHost}` : undefined}
              />
            </div>

            {/* 入站信息 */}
            <div className="p-4 rounded-xl bg-default-50 dark:bg-default-100/50 border border-divider">
              <div className="flex items-center gap-2 text-default-600 mb-3">
                <IoServer className="text-base" />
                <span className="text-sm font-semibold">入站详情</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <DetailItem label="入站名称" value={connection.metadata.inboundName} />
                <DetailItem label="入站端口" value={connection.metadata.inboundPort?.toString()} />
                <DetailItem label="入站 IP" value={connection.metadata.inboundIP} />
                <DetailItem label="用户 ID" value={connection.metadata.uid?.toString()} />
                <DetailItem label="DSCP" value={connection.metadata.dscp?.toString()} />
              </div>
            </div>

          </ScrollShadow>

          {/* 分隔线 */}
          <div className="w-px bg-divider" />

          {/* 右侧：代理链时间线 */}
          <div className="w-[280px] bg-default-50 dark:bg-default-100/30 p-4 flex flex-col">
            <div className="flex items-center gap-2 px-1 pb-3 border-b border-divider mb-4">
              <MdTimeline className="text-lg text-primary" />
              <span className="font-semibold text-foreground">代理链</span>
            </div>
            
            <ScrollShadow className="flex-1 flex flex-col gap-0 max-h-[400px] pr-1 pb-4">
              {/* 源节点 */}
              <TimelineNode 
                type="source"
                label="SOURCE"
                title={processPath ? processPath.split(/[\\/]/).pop() || 'Unknown' : 'Unknown'}
                subtitle={dayjs(connection.start).format('HH:mm:ss')}
                isFirst
              />

              {/* 代理链节点 */}
              {chainGroups.map((item, index) => {
                const { name, group } = item
                return (
                  <TimelineNode 
                    key={index}
                    type={group ? 'group' : 'proxy'}
                    label={group?.type?.toUpperCase()}
                    title={name}
                    subtitle={group?.now}
                    delay={group?.all?.find(p => p.name === group.now)?.history?.at(-1)?.delay}
                    delayColorClass={getDelayColorClass(group?.all?.find(p => p.name === group.now)?.history?.at(-1)?.delay || 0)}
                    icon={group?.icon}
                  />
                )
              })}

              {/* 目标节点 */}
              <TimelineNode 
                type="destination"
                label="DESTINATION"
                title={destination}
                isLast
              />
            </ScrollShadow>
          </div>

        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

// 信息卡片组件
interface InfoCardProps {
  icon: React.ReactNode
  label: string
  value?: string
  subValue?: string
  highlight?: boolean
  accent?: 'warning' | 'success' | 'danger'
}

const InfoCard: React.FC<InfoCardProps> = ({ icon, label, value, subValue, highlight, accent }) => (
  <div className={clsx(
    "p-4 rounded-xl border transition-colors",
    highlight 
      ? "bg-primary/5 border-primary/30" 
      : "bg-default-50 dark:bg-default-100/50 border-divider hover:bg-default-100 dark:hover:bg-default-200/50"
  )}>
    <div className="flex items-center gap-2 mb-2">
      <div className={clsx(
        "p-1.5 rounded-lg text-sm",
        highlight ? "bg-primary/10 text-primary" : "bg-default-200 dark:bg-default-300/50 text-default-600"
      )}>
        {icon}
      </div>
      <span className="text-xs font-semibold text-default-500 uppercase">{label}</span>
    </div>
    <div className="flex flex-col gap-0.5">
      <span 
        className={clsx(
          "text-sm font-bold font-mono truncate",
          accent === 'warning' ? "text-warning" : "text-foreground"
        )} 
        title={value}
      >
        {value || 'N/A'}
      </span>
      {subValue && (
        <span className="text-xs text-default-500 truncate" title={subValue}>{subValue}</span>
      )}
    </div>
  </div>
)

// 详情项组件
interface DetailItemProps {
  label: string
  value?: string
}

const DetailItem: React.FC<DetailItemProps> = ({ label, value }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[10px] uppercase text-default-500 font-semibold">{label}</span>
    <span className="text-sm font-mono text-foreground truncate" title={value}>
      {value || '-'}
    </span>
  </div>
)

// 时间线节点组件
interface TimelineNodeProps {
  type: 'source' | 'group' | 'proxy' | 'destination'
  label?: string
  title: string
  subtitle?: string
  delay?: number
  delayColorClass?: string
  icon?: string
  isFirst?: boolean
  isLast?: boolean
}

const TimelineNode: React.FC<TimelineNodeProps> = ({ 
  type, label, title, subtitle, delay, delayColorClass, icon, isFirst, isLast 
}) => {
  const colors = {
    source: 'border-success bg-success text-success',
    group: 'border-primary bg-primary text-primary',
    proxy: 'border-default-400 bg-default-400 text-default-500',
    destination: 'border-secondary bg-secondary text-secondary'
  }
  
  const [borderColor, dotColor, textColor] = colors[type].split(' ')
  
  return (
    <div className="relative pl-6 pb-4 last:pb-0">
      {/* 连接线 */}
      {!isLast && (
        <div className="absolute left-[9px] top-5 bottom-0 w-0.5 bg-default-200 dark:bg-default-300" />
      )}
      
      {/* 节点点 */}
      <div className={clsx(
        "absolute left-0 top-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center z-10 bg-content1",
        borderColor
      )}>
        <div className={clsx("w-2 h-2 rounded-full", dotColor)} />
      </div>

      {/* 内容卡片 */}
      <div className="ml-2 p-2.5 rounded-lg bg-content1 border border-divider hover:bg-default-50 dark:hover:bg-default-100/50 transition-colors">
        {/* 标签行 */}
        <div className="flex items-center justify-between mb-1">
          <span className={clsx("text-[10px] font-bold uppercase tracking-wide", textColor)}>
            {label || (type === 'proxy' ? 'PROXY' : '')}
          </span>
          {delay !== undefined && (
            <span className={clsx("text-xs font-mono font-bold", delayColorClass)}>
              {delay}ms
            </span>
          )}
          {isFirst && subtitle && (
            <div className="flex items-center gap-1 text-[10px] text-default-500">
              <IoTime className="text-xs" />
              <span>{subtitle}</span>
            </div>
          )}
        </div>
        
        {/* 标题 */}
        <div className="flex items-center gap-2">
          {icon && <img src={icon} className="w-4 h-4 object-contain" alt="" />}
          {type === 'source' && <IoCodeSlash className="text-default-500 text-sm shrink-0" />}
          {type === 'destination' && <FaGlobeAmericas className="text-default-500 text-sm shrink-0" />}
          <span className="text-sm font-medium text-foreground truncate" title={title}>{title}</span>
        </div>
        
        {/* 子标题（当前选择的节点） */}
        {!isFirst && subtitle && (
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-default-600 bg-default-100 dark:bg-default-200/50 px-2 py-1 rounded">
            <IoArrowForward className="text-[10px]" />
            <span className="font-mono truncate" title={subtitle}>{subtitle}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default ConnectionDetailModal
