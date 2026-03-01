import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Button,
  Select,
  SelectItem
} from '@heroui/react'
import React, { useState, useMemo, useRef, useLayoutEffect, useCallback } from 'react'
import { IoClose, IoGlobeOutline, IoPerson } from 'react-icons/io5'
import { TbPlugConnected, TbServer } from 'react-icons/tb'
import { motion } from 'framer-motion'
import { MdLink } from 'react-icons/md'
import { useGroups } from '@renderer/hooks/use-groups'

interface Props {
  chains: ChainItem[]
  onClose: () => void
}

const STYLE_VARIANTS = {
  user: {
    cardBg: 'bg-blue-500/10 dark:bg-blue-500/15',
    iconBg: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30',
    iconText: 'text-blue-600 dark:text-blue-400',
    badge: 'bg-blue-500/10 text-foreground border-blue-500/20',
    indicator: 'bg-blue-500'
  },
  dialer: {
    cardBg: 'bg-violet-500/10 dark:bg-violet-500/15',
    iconBg: 'bg-violet-500/20 text-violet-600 dark:text-violet-400 border-violet-500/30',
    iconText: 'text-violet-600 dark:text-violet-400',
    badge: 'bg-violet-500/10 text-foreground border-violet-500/20',
    indicator: 'bg-violet-500'
  },
  target: {
    cardBg: 'bg-orange-500/10 dark:bg-orange-500/15',
    iconBg: 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30',
    iconText: 'text-orange-600 dark:text-orange-400',
    badge: 'bg-orange-500/10 text-foreground border-orange-500/20',
    indicator: 'bg-orange-500'
  },
  internet: {
    cardBg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    iconBg: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    iconText: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-500/10 text-foreground border-emerald-500/20',
    indicator: 'bg-emerald-500'
  }
}

type VariantKey = keyof typeof STYLE_VARIANTS

interface NodeCardProps {
  icon: React.ElementType
  title: string
  name?: string
  variant: VariantKey
  index?: number
  targetGroups?: string[]
  groupInfo?: {
    isGroup: boolean
    activeNode?: string
    nodeCount?: number
    groupType?: string
  }
}

const NodeCard = React.memo(function NodeCard({ 
  icon: Icon, 
  title, 
  name,
  variant,
  index = 0,
  targetGroups,
  groupInfo
}: NodeCardProps) {
  const styles = STYLE_VARIANTS[variant]
  
  const getTypeLabel = () => {
    if (!groupInfo?.isGroup) return null
    const { groupType } = groupInfo
    if (groupType === 'URLTest') return '自动测速'
    if (groupType === 'Selector') return '手动指定'
    if (groupType === 'Fallback') return '故障转移'
    if (groupType === 'LoadBalance') return '负载均衡'
    return groupType
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1, ease: 'easeOut' }}
      className={`relative flex flex-col items-center p-6 w-[200px] h-[240px] rounded-3xl backdrop-blur-3xl backdrop-saturate-[1.5] border border-white/20 dark:border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_8px_32px_0_rgba(0,0,0,0.1)] hover:shadow-2xl transition-all duration-300 overflow-hidden hover:-translate-y-1 group ${styles.cardBg}`}
    >
      <div className={`flex items-center justify-center w-14 h-14 rounded-2xl mb-4 border shadow-inner transition-transform duration-300 group-hover:-translate-y-0.5 ${styles.iconBg}`}>
        <Icon className={`text-3xl drop-shadow-sm transition-transform duration-300 group-hover:scale-110 ${styles.iconText}`} />
      </div>
      
      <div className="flex flex-col items-center w-full grow">
        <span className="text-xs font-semibold text-default-400 tracking-wide mb-1 uppercase">{title}</span>
        <span 
          className="font-bold text-base text-foreground text-center break-words line-clamp-2 leading-snug drop-shadow-sm" 
          title={groupInfo?.activeNode || name}
        >
          {groupInfo?.activeNode || name || title}
        </span>
        
        {getTypeLabel() && (
          <span className="text-[10px] font-semibold text-default-500 mt-2 bg-default-200/50 dark:bg-white/5 backdrop-blur-md px-2 py-0.5 rounded-md border border-default-200/50 dark:border-white/5">
            {getTypeLabel()}
          </span>
        )}
      </div>
      
      <div className="absolute w-full bottom-0 left-0 px-4 pb-4">
        {(targetGroups && targetGroups.length > 0) ? (
          <div className="w-full flex justify-center">
            <div className={`px-3 py-1.5 rounded-xl text-center border shadow-inner max-w-full ${styles.badge}`}>
              <div className="opacity-80 mb-0.5 text-[9px] font-bold uppercase tracking-widest leading-none">应用策略组</div>
              <div className="text-xs font-bold truncate drop-shadow-sm" title={targetGroups.join(', ')}>
                {targetGroups.join(', ')}
              </div>
            </div>
          </div>
        ) : (groupInfo?.isGroup && groupInfo.nodeCount !== undefined) ? (
          <div className="w-full flex justify-center">
            <div className={`px-4 py-1.5 rounded-full text-[11px] font-black tracking-wide border shadow-inner ${styles.badge}`}>
              {groupInfo.nodeCount} 节点
            </div>
          </div>
        ) : null}
      </div>
    </motion.div>
  )
})

NodeCard.displayName = 'NodeCard'

const ConnectionLine = React.memo(function ConnectionLine({ delay, index = 0 }: { delay: number; index?: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scaleX: 0 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ duration: 0.6, delay: index * 0.15 + 0.2 }}
      className="relative w-16 md:w-24 h-[3px] mx-2 bg-default-200 dark:bg-white/10 overflow-hidden rounded-full shrink-0"
    >
      <motion.div
        className="absolute top-0 bottom-0 w-1/2 rounded-full"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(161, 161, 170, 0.4), rgba(161, 161, 170, 0.9), transparent)'
        }}
        animate={{ left: ['-100%', '200%'] }}
        transition={{ 
          repeat: Infinity, 
          duration: 2, 
          ease: 'linear',
          delay: delay
        }}
      />
    </motion.div>
  )
})

ConnectionLine.displayName = 'ConnectionLine'

const ScaleWrapper = React.memo(function ScaleWrapper({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const scaleRef = useRef(scale)

  useLayoutEffect(() => {
    const updateScale = () => {
      if (containerRef.current && contentRef.current) {
        const containerWidth = containerRef.current.clientWidth
        const contentWidth = contentRef.current.scrollWidth
        const newScale = containerWidth < contentWidth ? (containerWidth - 20) / contentWidth : 1
        const clampedScale = Math.max(0.5, Math.min(1, newScale))
        if (Math.abs(clampedScale - scaleRef.current) > 0.01) {
          scaleRef.current = clampedScale
          setScale(clampedScale)
        }
      }
    }

    updateScale()

    const observer = new ResizeObserver(() => updateScale())
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center overflow-visible">
      <div 
        ref={contentRef} 
        style={{ transform: `scale(${scale})` }} 
        className="origin-center transition-transform duration-300 ease-out py-8"
      >
        {children}
      </div>
    </div>
  )
})

ScaleWrapper.displayName = 'ScaleWrapper'

const ChainPreviewModal: React.FC<Props> = ({ chains, onClose }) => {
  const { groups } = useGroups()
  const [selectedChainId, setSelectedChainId] = useState<string>(
    chains.length > 0 ? chains[0].id : ''
  )

  const selectedChain = useMemo(
    () => chains.find((c) => c.id === selectedChainId),
    [chains, selectedChainId]
  )

  const findGroupByName = useCallback((searchName: string): ControllerMixedGroup | ControllerGroupDetail | undefined => {
    if (!groups || !searchName) return undefined
    
    const topLevel = groups.find(g => g.name === searchName)
    if (topLevel) return topLevel
    
    for (const group of groups) {
      if (group.all) {
        for (const item of group.all) {
          if ('all' in item && item.name === searchName) {
            return item as ControllerGroupDetail
          }
        }
      }
    }
    
    return undefined
  }, [groups])

  const getGroupInfo = useCallback((name?: string) => {
    if (!name) return undefined
    const group = findGroupByName(name)
    if (!group) return undefined
    return {
      isGroup: true,
      activeNode: group.now,
      nodeCount: 'all' in group ? (group as ControllerMixedGroup).all?.length : undefined,
      groupType: group.type
    }
  }, [findGroupByName])

  return (
    <Modal
      backdrop="blur"
      classNames={{ backdrop: 'top-[48px]' }}
      size="5xl"
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
    >
      <ModalContent className="bg-background/90 dark:bg-content1/80 border border-default-200 dark:border-white/10 shadow-2xl">
        <ModalHeader className="flex justify-between items-center pr-4 border-b border-default-200/50 dark:border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <MdLink className="text-xl text-primary" />
            <span className="font-bold">链路预览</span>
            <span className="text-xs font-medium text-default-400 opacity-80 bg-default-100 px-2 py-0.5 rounded-md ml-2">
              节点总数: {chains.length}
            </span>
          </div>
          <Button isIconOnly size="sm" variant="light" color="danger" onPress={onClose}>
            <IoClose className="text-lg" />
          </Button>
        </ModalHeader>
        <ModalBody className="py-6 min-h-[450px] flex flex-col pt-4">
          {chains.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-default-400">
              <div className="p-4 rounded-full bg-default-100 dark:bg-white/5 mb-4">
                <TbPlugConnected className="text-5xl opacity-50" />
              </div>
              <p className="font-medium text-default-500">暂无配置的代理链</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4 select-none px-1">
                <span className="text-sm font-semibold text-default-600 whitespace-nowrap">匹配链路选择</span>
                <Select
                  size="sm"
                  className="w-[280px]"
                  selectedKeys={selectedChainId ? new Set([selectedChainId]) : new Set()}
                  onSelectionChange={(keys) => {
                    const id = Array.from(keys)[0] as string
                    setSelectedChainId(id)
                  }}
                  classNames={{
                    trigger: "bg-default-100 dark:bg-default-50/50 shadow-none border border-default-200 dark:border-white/5"
                  }}
                >
                  {chains.map((chain) => (
                    <SelectItem key={chain.id} textValue={chain.name}>
                      {chain.name}
                    </SelectItem>
                  ))}
                </Select>
              </div>

              {selectedChain && (
                <div 
                  className="flex-1 rounded-3xl p-8 flex items-center justify-center relative overflow-hidden bg-default-50/50 dark:bg-background/50 border border-default-200/60 dark:border-white/5 shadow-inner"
                >
                  <div className="w-full h-full relative z-10">
                    <ScaleWrapper>
                      <div className="flex items-center justify-center min-w-max pb-4 px-4">
                        <NodeCard 
                          icon={IoPerson} 
                          title="用户" 
                          name="本机"
                          variant="user"
                          index={0}
                        />

                        <ConnectionLine delay={0} index={0} />

                        <NodeCard 
                          icon={TbServer} 
                          title="前置节点" 
                          name={selectedChain.dialerProxy}
                          variant="dialer"
                          index={1}
                          groupInfo={getGroupInfo(selectedChain.dialerProxy)}
                        />

                        <ConnectionLine delay={0.4} index={1} />

                        <NodeCard 
                          icon={TbServer} 
                          title="落地节点" 
                          name={selectedChain.targetProxy}
                          variant="target"
                          index={2}
                          groupInfo={getGroupInfo(selectedChain.targetProxy)}
                        />

                        <ConnectionLine delay={0.8} index={2} />

                        <NodeCard 
                          icon={IoGlobeOutline} 
                          title="互联网" 
                          name="目标站点"
                          variant="internet"
                          index={3}
                          targetGroups={selectedChain.targetGroups}
                        />
                      </div>
                    </ScaleWrapper>
                  </div>
                  
                  <div className="absolute bottom-6 left-0 right-0 flex justify-center z-20">
                    <div className="flex gap-6 px-6 py-2.5 rounded-2xl bg-background/80 dark:bg-content1/80 backdrop-blur-md border border-default-200 dark:border-white/10 shadow-sm">
                      {[
                        { variant: 'user', label: '用户', color: 'bg-blue-500' },
                        { variant: 'dialer', label: '前置节点', color: 'bg-violet-500' },
                        { variant: 'target', label: '落地节点', color: 'bg-orange-500' },
                        { variant: 'internet', label: '互联网', color: 'bg-emerald-500' }
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                          <span className="text-xs font-semibold text-default-600">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default ChainPreviewModal
