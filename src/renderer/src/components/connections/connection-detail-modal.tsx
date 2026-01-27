import { Modal, ModalContent, ModalHeader, ModalBody, Button, Chip, ScrollShadow } from '@heroui/react'
import React, { useMemo } from 'react'
import { calcTraffic } from '@renderer/utils/calc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useGroups } from '@renderer/hooks/use-groups'
import { IoClose, IoServer, IoEarth, IoShieldCheckmark, IoTime, IoCodeSlash, IoPerson } from 'react-icons/io5'
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
        backdrop: 'bg-background/10 backdrop-blur-md',
        wrapper: 'z-[9999]',
        base: 'bg-background/80 dark:bg-background/90 backdrop-blur-2xl border border-white/10 shadow-2xl dark:shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)]'
      }}
      size="5xl"
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      motionProps={{
        variants: {
          enter: { scale: 0.95, opacity: 1, transition: { duration: 0.2, ease: "easeOut" } },
          exit: { scale: 0.95, opacity: 0, transition: { duration: 0.15, ease: "easeIn" } },
        }
      }}
    >
      <ModalContent className="flag-emoji min-h-[600px]">
        {/* Header Section */}
        <ModalHeader className="flex flex-col gap-1 p-0 border-b border-white/5 bg-default-100/30">
          <div className="flex justify-between items-start p-6 pb-4">
            <div className="flex items-center gap-5">
              {/* Process Icon */}
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-white/10 shadow-inner flex items-center justify-center p-3 shrink-0">
                {localStorage.getItem(processPath || '') ? (
                  <img
                    src={localStorage.getItem(processPath || '') || ''}
                    className="w-full h-full object-contain drop-shadow-md"
                    alt=""
                  />
                ) : (
                  <FaGlobeAmericas className="text-3xl text-primary/40" />
                )}
              </div>
              
              {/* Title & Badges */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold tracking-tight text-foreground/90">{processName}</h2>
                  <Chip size="sm" variant="flat" color="primary" className="bg-primary/10 text-primary border border-primary/20 h-5">
                    {connection.metadata.network.toUpperCase()}
                  </Chip>
                  <Chip size="sm" variant="flat" className="h-5 bg-default-100/50 border border-white/5 text-default-500">
                    {connection.metadata.type}
                  </Chip>
                </div>

              </div>
            </div>

            <Button
              isIconOnly
              size="sm"
              variant="flat"
              className="bg-default-100 hover:bg-default-200 text-default-500 hover:text-foreground"
              onPress={onClose}
            >
              <IoClose className="text-xl" />
            </Button>
          </div>
          
          {/* Traffic Bar */}
          <div className="flex w-full bg-default-50/30 border-t border-white/5 divide-x divide-white/5">
             <div className="flex-1 px-6 py-3 flex items-center justify-between group hover:bg-primary/5 transition-colors">
                <span className="text-xs font-bold text-default-500 uppercase tracking-wider">Download</span>
                <div className="flex items-baseline gap-1">
                   <span className="text-lg font-mono font-bold text-foreground">{calcTraffic(connection.download)}</span>
                   <span className="text-xs font-mono text-success bg-success/10 px-1 rounded ml-2 font-bold">
                     ↓ {calcTraffic(connection.downloadSpeed || 0)}/s
                   </span>
                </div>
             </div>
             <div className="flex-1 px-6 py-3 flex items-center justify-between group hover:bg-primary/5 transition-colors">
                <span className="text-xs font-bold text-default-500 uppercase tracking-wider">Upload</span>
                <div className="flex items-baseline gap-1">
                   <span className="text-lg font-mono font-bold text-foreground">{calcTraffic(connection.upload)}</span>
                   <span className="text-xs font-mono text-primary bg-primary/10 px-1 rounded ml-2 font-bold">
                     ↑ {calcTraffic(connection.uploadSpeed || 0)}/s
                   </span>
                </div>
             </div>
          </div>
        </ModalHeader>

        <ModalBody className="p-0 flex flex-row overflow-hidden bg-content1/30">
          
          {/* Left: Metadata Dashboard */}
          <ScrollShadow className="flex-1 p-6 flex flex-col gap-6 max-h-[600px] overflow-y-auto">
            
            {/* Meta Grid */}
            <div className="grid grid-cols-2 gap-4">
               {/* Source */}
               <InfoCard 
                 icon={<IoPerson />} 
                 label="Source" 
                 value={source} 
                 subValue={connection.metadata.sourceGeoIP || 'Local Network'}
               />
               
               {/* Destination */}
               <InfoCard 
                 icon={<FaNetworkWired />} 
                 label="Destination" 
                 value={destination} 
                 subValue={connection.metadata.destinationGeoIP ? `${connection.metadata.destinationGeoIP} ${connection.metadata.destinationIPASN || ''}` : connection.metadata.host ? 'Resolved IP Pending' : 'Direct IP'}
                 highlight
               />
               
               {/* Rule */}
               <InfoCard 
                 icon={<IoShieldCheckmark />} 
                 label="Rule" 
                 value={connection.rulePayload || connection.rule} 
                 subValue={connection.rulePayload ? connection.rule : undefined}
                 accent="warning"
               />
               
               {/* DNS */}
               <InfoCard 
                 icon={<IoEarth />} 
                 label="DNS Mode" 
                 value={connection.metadata.dnsMode} 
                 subValue={connection.metadata.sniffHost ? `Sniff: ${connection.metadata.sniffHost}` : undefined}
               />
            </div>

            {/* Inbound Info */}
            <div className="p-4 rounded-2xl bg-content1 border border-default-200 shadow-sm flex flex-col gap-4">
               <div className="flex items-center gap-2 text-default-500">
                 <IoServer /> Inbound Details
               </div>
               <div className="grid grid-cols-3 gap-y-4 gap-x-8">
                  <DetailItem label="Inbound Name" value={connection.metadata.inboundName} />
                  <DetailItem label="Inbound Port" value={connection.metadata.inboundPort?.toString()} />
                  <DetailItem label="Inbound IP" value={connection.metadata.inboundIP} />
                  <DetailItem label="User ID" value={connection.metadata.uid?.toString()} />
                  <DetailItem label="DSCP" value={connection.metadata.dscp?.toString()} />
               </div>
            </div>

          </ScrollShadow>

          {/* Vertical Divider */}
          <div className="w-px bg-white/5 my-4" />

          {/* Right: Proxy Chain Timeline */}
          <div className="w-[320px] bg-default-50/20 backdrop-blur-sm p-4 flex flex-col gap-4 border-l border-white/5">
             <div className="flex items-center gap-2 px-2 pb-2 border-b border-white/5">
                <MdTimeline className="text-xl text-primary" />
                <span className="font-bold text-foreground/80">Timeline</span>
             </div>
             
             <ScrollShadow className="flex-1 flex flex-col gap-0 max-h-[500px] pt-4 pr-2">
                {/* 1. Source Node */}
                <div className="relative pl-6 pb-6 group">
                   {/* Line */}
                   <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-default-200/50 group-hover:bg-primary/30 transition-colors" />
                   
                   {/* Dot (Green for Start) */}
                   <div className="absolute left-0 top-1.5 w-[22px] h-[22px] rounded-full border-2 border-success bg-background shadow-[0_0_10px_rgba(23,201,100,0.3)] flex items-center justify-center z-10">
                     <div className="w-2 h-2 rounded-full bg-success" />
                   </div>

                   {/* Card */}
                   <div className="p-3 rounded-xl border border-success/20 bg-content1 shadow-sm ml-2 transition-all duration-300 hover:bg-content2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-success uppercase tracking-wider">Source</span>
                        <div className="flex items-center gap-1.5 text-xs font-mono text-default-500">
                          <IoTime />
                          <span>{dayjs(connection.start).format('HH:mm:ss')}</span>
                        </div>
                      </div>
                       <div className="flex items-center gap-2" title={processPath}>
                         <IoCodeSlash className="text-default-500 shrink-0" />
                         <span className="text-sm font-medium text-foreground truncate">{processPath ? processPath.split(/[\\/]/).pop() : 'Unknown'}</span>
                       </div>
                   </div>
                </div>

                {/* 2. Chain Nodes */}
                {chainGroups.map((item, index) => {
                  const { name, group } = item

                  
                  return (
                    <div key={index} className="relative pl-6 pb-6 last:pb-0 group">
                       {/* Line (always visible because we have Destination at the end) */}
                       <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-default-200/50 group-hover:bg-primary/30 transition-colors" />
                       
                       {/* Dot */}
                       <div className={clsx(
                         "absolute left-0 top-1.5 w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center z-10 transition-all duration-300",
                         group 
                           ? "border-primary bg-background shadow-[0_0_10px_rgba(var(--heroui-primary),0.3)]" 
                           : "border-default-400 bg-background"
                       )}>
                         <div className={clsx("w-2 h-2 rounded-full", group ? "bg-primary" : "bg-default-400")} />
                       </div>

                       {/* Card */}
                       <div className={clsx(
                         "p-3 rounded-xl border transition-all duration-300 ml-2",
                         group 
                           ? "bg-content1 border-primary/20 hover:bg-content2 shadow-sm"
                           : "bg-content1 border-default-200 hover:bg-content2"
                       )}>
                          {/* Name & Type */}
                          <div className="flex items-center justify-between mb-1">
                             <div className="font-bold text-sm tracking-tight flex items-center gap-2 text-foreground" title={name}>
                                {name} 
                                {group && <span className="text-[10px] px-1.5 py-0.5 bg-default-200/50 rounded text-default-600 font-mono font-bold uppercase">{group.type}</span>}
                             </div>
                             {group && (
                               <span className={clsx("text-xs font-mono font-bold", getDelayColorClass(group.all?.find(p => p.name === group.now)?.history?.at(-1)?.delay || 0))}>
                                  {group.all?.find(p => p.name === group.now)?.history?.at(-1)?.delay || '-'}ms
                               </span>
                             )}
                          </div>
                          
                          {/* Current Selection */}
                          {group && (
                            <div className="flex items-center gap-2 mt-2 text-xs text-foreground/80 bg-background/40 p-1.5 rounded-lg border border-white/5 shadow-inner">
                               {group.icon && <img src={group.icon} className="w-4 h-4 object-contain" />}
                               <span className="font-mono truncate font-medium" title={group.now}>{group.now}</span>
                            </div>
                          )}
                       </div>
                    </div>
                  )
                })}

                {/* 3. Destination Node */}
                <div className="relative pl-6 pb-6 group">
                   
                   {/* Dot (Primary/Blue for Target) */}
                   <div className="absolute left-0 top-1.5 w-[22px] h-[22px] rounded-full border-2 border-secondary bg-background shadow-[0_0_10px_rgba(var(--heroui-secondary),0.3)] flex items-center justify-center z-10">
                     <div className="w-2 h-2 rounded-full bg-secondary" />
                   </div>

                   {/* Card */}
                   <div className="p-3 rounded-xl border border-secondary/20 bg-content1 shadow-sm ml-2 transition-all duration-300 hover:bg-content2">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-secondary uppercase tracking-wider">Destination</span>
                      </div>
                       <div className="flex items-center gap-2">
                         <FaGlobeAmericas className="text-default-500 shrink-0" />
                         <span className="text-sm font-medium text-foreground truncate select-text" title={destination}>{destination}</span>
                       </div>
                   </div>
                </div>
             </ScrollShadow>
          </div>

        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

// Sub-components for cleaner code
const InfoCard = ({ icon, label, value, subValue, highlight, accent }: any) => (
  <div className={clsx(
    "p-4 rounded-2xl border flex flex-col gap-3 transition-all duration-300",
    highlight 
      ? "bg-primary/10 border-primary/20 shadow-sm" 
      : "bg-content1 border-default-200 shadow-sm hover:bg-content2"
  )}>
     <div className="flex items-center gap-2 text-default-500">
        <div className={clsx("p-1.5 rounded-lg", highlight ? "bg-primary/10 text-primary" : "bg-default-200/50 text-default-600")}>
           {icon}
        </div>
        <span className="text-xs font-bold uppercase tracking-wider opacity-90">{label}</span>
     </div>
     <div className="flex flex-col">
        <span className={clsx("text-base font-bold font-mono truncate text-foreground", accent === 'warning' && "text-warning")} title={value}>
           {value || 'N/A'}
        </span>
        {subValue && (
          <span className="text-xs text-default-500 truncate mt-0.5 font-medium" title={subValue}>{subValue}</span>
        )}
     </div>
  </div>
)

const DetailItem = ({ label, value }: any) => (
  <div className="flex flex-col gap-1">
     <span className="text-[10px] uppercase text-default-500 font-bold tracking-wider">{label}</span>
     <span className="text-sm font-mono text-foreground font-medium truncate border-b border-dashed border-default-200/50 pb-0.5 hover:text-primary transition-colors cursor-copy" title={value}>
       {value || '-'}
     </span>
  </div>
)

export default ConnectionDetailModal
