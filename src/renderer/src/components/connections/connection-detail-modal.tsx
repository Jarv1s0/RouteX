import { Modal, ModalContent, ModalHeader, ModalBody, Button, Chip, ScrollShadow } from '@heroui/react'
import React, { useMemo } from 'react'
import { calcTraffic } from '@renderer/utils/calc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useGroups } from '@renderer/hooks/use-groups'
import { 
  IoServer, 
  IoEarth, 
  IoShieldCheckmark, 
  IoPerson, 
  IoArrowForward,
  IoSwapVertical,
  IoCopy,
  IoUnlink
} from 'react-icons/io5'
import { Tooltip } from '@heroui/react'
import { MdTimeline } from 'react-icons/md'
import { FaGlobeAmericas, FaNetworkWired } from 'react-icons/fa'
import { clsx } from 'clsx'
import dayjs from 'dayjs'
import SecondaryModalCloseButton from '@renderer/components/base/secondary-modal-close'
import { createSecondaryModalClassNames, getMainPaneModalContentStyle } from '@renderer/utils/modal-styles'

interface Props {
  connection: ControllerConnectionDetail
  onClose: () => void
  onDisconnect?: (id: string) => void
}

const ConnectionDetailModal: React.FC<Props> = (props) => {
  const { connection, onClose, onDisconnect } = props
  const {
    appConfig: {
      disableAnimation = false,
      delayThresholds = { good: 200, fair: 500 },
      collapseSidebar = false,
      siderWidth = 250
    } = {}
  } = useAppConfig()
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
      
      // 如果不是组，尝试在所有组的一级子节点中查找该代理以获取详情（如延迟）
      let leafProxy: ControllerProxiesDetail | undefined
      if (!group) {
        for (const g of groups) {
          const found = g.all?.find(p => p.name === chainName)
          if (found) {
            leafProxy = found
            break
          }
        }
      }

      return { name: chainName, group, leafProxy, isLast: index === connection.chains.length - 1 }
    }).reverse()
  }, [connection.chains, groups])

  // 格式化 IP 和 端口
  const source = `${connection.metadata.sourceIP}:${connection.metadata.sourcePort}`
  const destination = connection.metadata.host 
    ? `${connection.metadata.host}:${connection.metadata.destinationPort}`
    : `${connection.metadata.destinationIP}:${connection.metadata.destinationPort}`

  const processName = connection.metadata.process || 'Unknown Process'
  const processPath = connection.metadata.processPath
  const sniffSummary = connection.metadata.sniffHost
    ? '已嗅探'
    : connection.metadata.host
      ? '域名'
      : 'IP'

  // 1. Duration Timer Logic
  const [duration, setDuration] = React.useState('')
  React.useEffect(() => {
    const completedAt = connection.completedAt
    
    const updateDuration = () => {
      const end = completedAt ? dayjs(completedAt) : dayjs()
      const diff = end.diff(dayjs(connection.start))
      const hours = Math.floor(diff / 3600000)
      const minutes = Math.floor((diff % 3600000) / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)
      setDuration(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
    }
    
    updateDuration()
    
    // 如果已经有结束时间，则不需要定时器刷新
    if (completedAt) return

    const timer = setInterval(updateDuration, 1000)
    return () => clearInterval(timer)
  }, [connection.start, connection.completedAt])

  return (
    <Modal
      backdrop={disableAnimation ? 'transparent' : 'blur'}
      disableAnimation={disableAnimation}
      classNames={createSecondaryModalClassNames({
        backdrop: 'bg-black/40 backdrop-blur-sm',
        wrapper: 'z-[9999]',
        base: 'bg-background/60 dark:bg-default-100/50 max-h-[90vh]'
      })}
      size="5xl"
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      motionProps={{
        variants: {
          enter: { scale: 1, opacity: 1, filter: "blur(0px)", transition: { duration: 0.25, ease: [0.32, 0.72, 0, 1] } },
          exit: { scale: 0.96, opacity: 0, filter: "blur(4px)", transition: { duration: 0.2, ease: "easeIn" } },
        }
      }}
    >
      <ModalContent
        className="overflow-hidden"
        style={getMainPaneModalContentStyle({ collapseSidebar, siderWidth, maxWidthPx: 1400 })}
      >
        {/* Header Section */}
        <ModalHeader className="flex flex-col gap-0 p-0 relative overflow-hidden bg-gradient-to-b from-default-100/50 to-transparent">
          {/* 顶部背景装饰 */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />

          {/* Close Button - Absolute Positioned */}
          <SecondaryModalCloseButton onPress={onClose} className="absolute right-4 top-4 z-50" />

          {/* 标题栏 */}
          <div className="flex justify-between items-start px-2 pt-2 pb-2 z-10">
            <div className="flex items-start gap-6 min-w-0 flex-1 pr-14">
              {/* 进程图标 */}
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-default-100 to-default-50 border border-white/20 shadow-lg flex items-center justify-center shrink-0">
                {localStorage.getItem(processPath || '') ? (
                  <img
                    src={localStorage.getItem(processPath || '') || ''}
                    className="w-10 h-10 object-contain drop-shadow-md"
                    alt=""
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                    <FaGlobeAmericas className="text-2xl text-primary" />
                  </div>
                )}
              </div>
              
              {/* 标题信息 */}
              <div className="flex flex-col pt-1 min-w-0 flex-1">
                <Tooltip content={processPath || 'Unknown Path'} placement="bottom" showArrow={true} classNames={{ base: "before:bg-default-200 after:bg-default-200", content: "bg-content1 text-default-500 font-mono text-xs px-2 py-1 shadow-sm border border-default-200" }}>
                  <h2 className="text-2xl font-bold text-foreground tracking-tight mb-2 cursor-help decoration-dashed decoration-default-300 underline-offset-4 w-fit">{processName}</h2>
                </Tooltip>
                <div className="flex items-center gap-2 flex-wrap">
                  <Chip size="sm" variant="flat" color="primary" className="h-6 px-1 bg-primary/10 text-primary font-medium border border-primary/20">
                    {connection.metadata.network.toUpperCase()}
                  </Chip>
                  <Chip size="sm" variant="flat" className="h-6 px-1 bg-default-100 text-default-600 font-medium border border-default-200">
                    {connection.metadata.type}
                  </Chip>
                  <Chip size="sm" variant="flat" className="h-6 px-1 bg-content2 text-foreground font-mono font-bold border border-default-200 min-w-[60px] justify-center">
                    {duration}
                  </Chip>
                  {connection.rule && (
                     <Chip size="sm" variant="flat" color="warning" className="h-6 px-1 bg-warning/10 text-warning font-medium border border-warning/20 max-w-[180px] opacity-85">
                      <span className="truncate">{connection.rule}</span>
                     </Chip>
                  )}
                  {onDisconnect && (
                    <Button
                      size="sm"
                      variant="flat"
                      color="danger"
                      className="h-6 min-w-0 rounded-md px-2 text-xs font-medium"
                      startContent={<IoUnlink className="text-sm" />}
                      onPress={() => onDisconnect(connection.id)}
                    >
                      断开
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ModalHeader>

        <ModalBody className="p-0 flex flex-row h-[520px] bg-content1/30 gap-2">
          
          {/* 左侧：详细信息 */}
          <ScrollShadow className="flex-1 p-2 pr-2 flex flex-col gap-2">
            <div className="overflow-x-auto rounded-xl bg-default-50/60 dark:bg-content1/10 backdrop-blur-md border border-default-200/50 dark:border-white/5 shadow-sm px-4 py-2">
              <div className="flex min-w-max items-center justify-between gap-6 whitespace-nowrap">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <IoSwapVertical className="text-lg text-[#c084fc] rotate-180" />
                    <div className="flex items-center leading-none gap-2">
                      <span className="font-mono font-bold text-sm text-foreground">
                        {calcTraffic(connection.download)}
                      </span>
                      <span className="text-[10px] text-default-400 font-mono">
                        {calcTraffic(connection.downloadSpeed || 0)}/s
                      </span>
                    </div>
                  </div>
                  <div className="h-4 w-px bg-default-300/30" />
                  <div className="flex items-center gap-2">
                    <div className="flex items-center leading-none gap-2">
                      <span className="font-mono font-bold text-sm text-foreground">
                        {calcTraffic(connection.upload)}
                      </span>
                      <span className="text-[10px] text-default-400 font-mono">
                        {calcTraffic(connection.uploadSpeed || 0)}/s
                      </span>
                    </div>
                    <IoSwapVertical className="text-lg text-[#22d3ee]" />
                  </div>
                </div>
                <div className="ml-auto">
                  <InlineSummary label="嗅探" value={sniffSummary} tone="warning" />
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {/* 目标地址卡片 */}
              <div className="h-full p-4 rounded-xl bg-default-50/60 dark:bg-content1/10 backdrop-blur-md border border-default-200/50 dark:border-white/5 shadow-sm hover:border-default-300/60 transition-colors group relative">
                <div className="flex items-center gap-2.5 mb-3 opacity-80 group-hover:opacity-100 transition-opacity">
                  <div className="p-1.5 rounded-lg bg-blue-500/15 text-blue-500">
                    <FaNetworkWired className="text-sm" />
                  </div>
                  <span className="text-xs font-bold text-blue-500/80 uppercase tracking-wide">目标地址</span>
                </div>
                <span className="text-base font-bold text-foreground font-mono break-all leading-tight block pr-6">
                  {destination}
                </span>
                <div className="flex items-center gap-2 mt-1.5">
                   {connection.metadata.destinationGeoIP && (
                     <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-default-100 text-default-600 border border-default-200/50">
                       {connection.metadata.destinationGeoIP}
                     </span>
                   )}
                   {connection.metadata.destinationIPASN && (
                      <span className="text-[10px] text-default-400">
                        {connection.metadata.destinationIPASN}
                      </span>
                   )}
                </div>
                <div 
                  onClick={() => navigator.clipboard.writeText(destination)}
                  className="absolute top-3 right-3 p-1.5 rounded-md text-default-400 hover:text-primary hover:bg-default-100 opacity-0 group-hover:opacity-100 transition-all cursor-pointer z-20"
                  title="Copy"
                >
                  <IoCopy className="text-xs" />
                </div>
              </div>

               {/* 源地址 — 绿色主题 */}
               <InfoCard 
                icon={<IoPerson />} 
                label="源地址" 
                value={source} 
                subValue={connection.metadata.sourceGeoIP?.join(' ') || 'Local Network'}
                theme="green"
              />
            </div>
            
            {/* 辅助信息网格 */}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <InfoCard 
                icon={<IoShieldCheckmark />} 
                label="规则" 
                value={connection.rule || 'N/A'} 
                subValue={
                  connection.rulePayload
                    ? `命中值: ${connection.rulePayload}`
                    : connection.rule
                      ? '无规则值'
                      : undefined
                }
                theme="purple"
              />
              <InfoCard 
                icon={<IoEarth />} 
                label="DNS 模式" 
                value={connection.metadata.dnsMode} 
                subValue={connection.metadata.sniffHost ? `Sniffed: ${connection.metadata.sniffHost}` : undefined}
                theme="orange"
              />
            </div>

            {/* 入站详情 — divider 横条布局 */}
            <div className="rounded-xl bg-default-50/60 dark:bg-content1/10 backdrop-blur-md border border-default-200/50 dark:border-white/5 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-secondary/5 border-b border-default-200/50 dark:border-white/5">
                <div className="p-1 rounded-md bg-secondary/15 text-secondary">
                  <IoServer className="text-sm" />
                </div>
                <span className="text-xs font-bold text-secondary/80 uppercase tracking-wide">入站详情</span>
              </div>
              <div className="divide-y divide-default-200/40 dark:divide-white/5">
                {[
                  { label: '入站名称', value: connection.metadata.inboundName },
                  { label: '入站端口', value: connection.metadata.inboundPort?.toString() },
                  { label: '入站 IP', value: connection.metadata.inboundIP },
                  { label: '用户 ID', value: connection.metadata.uid?.toString() },
                  { label: 'DSCP', value: connection.metadata.dscp?.toString() },
                ].filter(item => item.value !== undefined && item.value !== '').map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between px-4 py-2 hover:bg-default-100/50 transition-colors">
                    <span className="text-xs text-default-400 font-medium w-24 shrink-0">{label}</span>
                    <span className="text-xs font-mono text-foreground text-right truncate select-all" title={value}>{value || '-'}</span>
                  </div>
                ))}
              </div>
            </div>

          </ScrollShadow>



          {/* 右侧：可视化代理链 */}
          <div className="w-[320px] bg-default-50/30 dark:bg-black/5 p-2 flex flex-col relative overflow-hidden backdrop-brightness-95 dark:backdrop-brightness-100 -ml-2">
            {/* 背景装饰线 */}
            <div className="absolute left-[23px] top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-default-300 to-transparent dashed opacity-30" />

            <div className="flex items-center gap-2 mb-2 relative z-10">
              <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                 <MdTimeline className="text-lg" />
              </div>
              <span className="font-bold text-foreground tracking-wide">连接链路</span>
            </div>
            
            <ScrollShadow className="flex-1 -mr-4 pr-4 relative z-10 pb-4">
              <div className="flex flex-col gap-0">
                {/* 源节点 */}
                <TimelineNode 
                  type="source"
                  title={processPath ? processPath.split(/[\\/]/).pop() || 'Unknown' : 'Unknown'}
                  time={dayjs(connection.start).format('HH:mm:ss')}
                />

                {/* 规则节点 */}
                {(connection.rule || connection.rulePayload) && (
                  <TimelineNode
                    type="proxy"
                    title={connection.rule || '规则'}
                    subtitle={connection.rulePayload ? `命中值: ${connection.rulePayload}` : undefined}
                    tagLabel="规则"
                    tagClassName="text-warning bg-warning/10"
                  />
                )}

                {/* 代理链节点 */}
                {chainGroups.map((item, index) => {
                  const { name, group, leafProxy } = item

                  // 如果当前节点的名字与上一个节点组的选择(now)相同，则隐藏（避免重复）
                  // 仅当当前项不是组时隐藏（显示组更有意义）
                  const prevItem = chainGroups[index - 1]
                  if (!group && prevItem && prevItem.group && prevItem.group.now === name) {
                    return null
                  }
                  
                  let delay: number | undefined
                  if (group) {
                    delay = group.all?.find(p => p.name === group.now)?.history?.at(-1)?.delay
                  } else if (leafProxy) {
                    delay = leafProxy.history?.at(-1)?.delay
                  }

                  return (
                    <TimelineNode 
                      key={index}
                      type={'proxy'}
                      title={name}
                      subtitle={group?.now ? `当前: ${group.now}` : undefined}
                      delay={delay}
                      delayColorClass={delay === undefined ? undefined : getDelayColorClass(delay)}
                      isGroup={!!group}
                      icon={group?.icon}
                      groupType={group?.type}
                    />
                  )
                })}

                {/* 目标节点 */}
                <TimelineNode 
                  type="destination"
                  title={connection.metadata.host || connection.metadata.destinationIP || destination}
                  subtitle={
                    connection.metadata.destinationPort
                      ? `端口 ${connection.metadata.destinationPort}`
                      : undefined
                  }
                  isLast
                />
              </div>
            </ScrollShadow>
          </div>

        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

// ----------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------

// 1. InfoCard - 通用信息卡片
interface InfoCardProps {
  icon: React.ReactNode
  label: string
  value?: string
  subValue?: string
  theme?: 'green' | 'purple' | 'orange' | 'blue' | 'default'
  /** @deprecated */
  accent?: string
  /** @deprecated */
  iconWrapperClassName?: string
}

interface InlineSummaryProps {
  label: string
  value: string
  tone: 'primary' | 'success' | 'warning'
}

const NEUTRAL_CARD = 'bg-default-50/60 dark:bg-content1/10 border-default-200/50 dark:border-white/5 hover:border-default-300/60'

const THEME_MAP = {
  green:   { icon: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',  label: 'text-emerald-700/70 dark:text-emerald-300/75',  value: 'text-foreground'  },
  purple:  { icon: 'bg-purple-500/15 text-purple-500', label: 'text-purple-500/80', value: 'text-purple-500' },
  orange:  { icon: 'bg-warning/15 text-warning',       label: 'text-warning/80',    value: 'text-foreground'  },
  blue:    { icon: 'bg-blue-500/15 text-blue-500',     label: 'text-blue-500/80',   value: 'text-foreground'  },
  default: { icon: 'bg-default-100 text-default-500',  label: 'text-default-500',   value: 'text-foreground'  },
} as const

const INLINE_SUMMARY_TONE = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning'
} as const

const InlineSummary: React.FC<InlineSummaryProps> = ({ label, value, tone }) => {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-default-200/60 bg-default-100/60 px-2.5 py-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
      <span
        className={clsx(
          'rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em]',
          INLINE_SUMMARY_TONE[tone]
        )}
      >
        {label}
      </span>
      <span className="max-w-[72px] truncate text-xs font-semibold text-foreground" title={value}>
        {value}
      </span>
    </div>
  )
}

const InfoCard: React.FC<InfoCardProps> = ({ icon, label, value, subValue, theme = 'default' }) => {
  const t = THEME_MAP[theme]
  const handleCopy = () => { if (value) navigator.clipboard.writeText(value) }

  return (
    <div className={`h-full p-4 rounded-xl backdrop-blur-md border shadow-sm transition-colors group relative ${NEUTRAL_CARD}`}>
      <div className="flex items-center gap-2.5 mb-2 opacity-80 group-hover:opacity-100 transition-opacity">
        <div className={clsx('p-1.5 rounded-lg text-sm', t.icon)}>{icon}</div>
        <span className={`text-xs font-bold uppercase tracking-wide ${t.label}`}>{label}</span>
      </div>
      <span className={clsx('text-sm font-bold font-mono truncate block pr-6', t.value)} title={value}>
        {value || 'N/A'}
      </span>
      {subValue && (
        <span className="text-xs text-default-400 truncate mt-0.5 block" title={subValue}>{subValue}</span>
      )}
      {value && (
        <div
          onClick={handleCopy}
          className="absolute top-3 right-3 p-1.5 rounded-md text-default-400 hover:text-primary hover:bg-default-100 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
          title="Copy"
        >
          <IoCopy className="text-xs" />
        </div>
      )}
    </div>
  )
}

// 3. TimelineNode - 时间线/路径节点
interface TimelineNodeProps {
  type: 'source' | 'proxy' | 'destination'
  title: string
  subtitle?: string
  time?: string
  delay?: number
  delayColorClass?: string
  isLast?: boolean
  isGroup?: boolean
  groupType?: string
  icon?: string
  tagLabel?: string
  tagClassName?: string
}

const TimelineNode: React.FC<TimelineNodeProps> = ({ 
  type, title, subtitle, time, delay, delayColorClass, isLast, isGroup, groupType, icon, tagLabel, tagClassName
}) => {
  const nonGroupInsetClass = isGroup ? '' : 'px-3'
  
  return (
    <div className="relative pl-9 pb-4 last:pb-0 group">
      {/* 连接线 */}
      {!isLast && (
        <div className="absolute left-[15px] top-7 bottom-0 w-0.5 bg-default-200/50 group-hover:bg-primary/20 transition-colors" />
      )}
      
      {/* 节点图标/圆点 */}
      <div className={clsx(
        "absolute left-[6px] top-1 w-5 h-5 rounded-full border-[3px] z-10 flex items-center justify-center transition-all bg-content1",
        type === 'source' ? "border-emerald-500/50 w-5 h-5 shadow-[0_0_0_2px_rgba(16,185,129,0.1)]" :
        type === 'destination' ? "border-secondary w-5 h-5 shadow-[0_0_0_2px_rgba(151,80,221,0.2)]" :
        "border-default-300 group-hover:border-primary group-hover:w-5 group-hover:h-5 w-4 h-4 left-[8px] top-1.5"
      )}>
        {/* 中心点，仅 Source/Dest 显示 */}
        {(type === 'source' || type === 'destination') && (
           <div className={clsx(
             "w-1.5 h-1.5 rounded-full",
             type === 'source' ? "bg-emerald-500/75" : "bg-secondary"
           )} />
        )}
      </div>

      {/* 内容主体 */}
        <div className={clsx(
          "relative rounded-xl border p-3 transition-all",
          isGroup 
            ? "bg-content1/80 dark:bg-default-100/80 border-default-300/60 dark:border-white/10 hover:border-primary/40 shadow-sm hover:shadow-md backdrop-blur-sm" 
            : "bg-transparent border-transparent px-0 py-0" 
        )}>
          {/* 顶部标签行 */}
        <div className={clsx("grid grid-cols-[minmax(0,1fr)_88px] items-center gap-2 mb-1", nonGroupInsetClass)}>
            <div className="flex min-w-0 items-center gap-1.5">
            {type === 'source' && <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase bg-emerald-500/10 px-1.5 rounded">起点</span>}
            {type === 'destination' && <span className="text-[10px] font-bold text-purple-500 uppercase bg-purple-500/10 px-1.5 rounded">终点</span>}
            {tagLabel && !isGroup && type !== 'source' && type !== 'destination' && (
              <span className={clsx("text-[10px] font-bold uppercase px-1.5 rounded", tagClassName || "text-default-400 bg-default-100")}>
                {tagLabel}
              </span>
            )}
            {isGroup && (
               <span className="text-[10px] font-bold text-primary uppercase bg-primary/10 px-1.5 rounded">
                 {groupType || '策略组'}
               </span>
            )}
            {!isGroup && type === 'proxy' && (
              <span className="text-[10px] font-bold text-default-400 uppercase bg-default-100 px-1.5 rounded">节点</span>
            )}
          </div>
          
          {/* 延迟显示 */}
          {delay !== undefined && (
            <div className="flex w-[88px] items-center justify-end gap-[2px] font-mono tabular-nums">
               <div className={clsx("w-1.5 h-1.5 shrink-0 rounded-full", delayColorClass?.replace('text-', 'bg-'))} />
               <span className={clsx("inline-block w-[48px] text-right text-xs font-mono font-bold tabular-nums", delayColorClass)}>
                 {delay === 0 ? 'Timeout' : `${delay}ms`}
               </span>
            </div>
          )}
          {time && (
            <span className="w-[88px] justify-self-end text-right text-[10px] font-mono tabular-nums text-default-400">{time}</span>
          )}
        </div>
        
        {/* 标题 */}
          <div className={clsx("flex items-center gap-2 min-w-0", nonGroupInsetClass)}>
            {icon && <img src={icon} className="w-3.5 h-3.5 object-contain opacity-80" alt="" />}
            <span className={clsx(
              "text-sm font-medium truncate pr-2",
              isGroup ? "text-foreground" : "text-default-700"
            )} title={title}>
              {title}
            </span>
          </div>
          
          {/* 只有 Group 节点显示具体的节点选择 */}
          {subtitle && (
            <div className={clsx("mt-1.5 flex items-center gap-1.5 text-xs text-default-500 bg-content2/50 p-1.5 rounded-md border border-default-200/50", nonGroupInsetClass)}>
              <IoArrowForward className="text-[10px] shrink-0 text-primary" />
              <span className="font-mono truncate font-bold text-primary" title={subtitle}>{subtitle}</span>
            </div>
        )}
      </div>
    </div>
  )
}

export default ConnectionDetailModal
