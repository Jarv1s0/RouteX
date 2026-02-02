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

// 高对比度颜色配置
const COLORS = {
  indigo: {
    border: '#6366F1',
    bg: 'rgba(99, 102, 241, 0.30)',
    text: '#FFFFFF',
    textSecondary: '#A5B4FC',
    icon: '#FFFFFF',
    iconBg: 'rgba(99, 102, 241, 0.45)'
  },
  cyan: {
    border: '#06B6D4',
    bg: 'rgba(6, 182, 212, 0.35)',
    text: '#FFFFFF',
    textSecondary: '#67E8F9',
    icon: '#FFFFFF',
    iconBg: 'rgba(6, 182, 212, 0.5)'
  },
  orange: {
    border: '#F97316',
    bg: 'rgba(249, 115, 22, 0.35)',
    text: '#FFFFFF',
    textSecondary: '#FDBA74',
    icon: '#FFFFFF',
    iconBg: 'rgba(249, 115, 22, 0.5)'
  },
  emerald: {
    border: '#10B981',
    bg: 'rgba(16, 185, 129, 0.35)',
    text: '#FFFFFF',
    textSecondary: '#6EE7B7',
    icon: '#FFFFFF',
    iconBg: 'rgba(16, 185, 129, 0.5)'
  }
}

type ColorKey = keyof typeof COLORS

// NodeCard 移到组件外部避免无限刷新
interface NodeCardProps {
  icon: React.ElementType
  title: string
  name?: string
  color: ColorKey
  index?: number
  groupInfo?: {
    isGroup: boolean
    activeNode?: string
    nodeCount?: number
    groupType?: string
  }
}

const NodeCard: React.FC<NodeCardProps> = React.memo(({ 
  icon: Icon, 
  title, 
  name,
  color,
  index = 0,
  groupInfo
}) => {
  const colorConfig = COLORS[color]
  
  const getTypeLabel = () => {
    if (!groupInfo?.isGroup) return null
    const { groupType } = groupInfo
    if (groupType === 'URLTest') return '动态节点'
    if (groupType === 'Selector') return '手动选择'
    if (groupType === 'Fallback') return '故障转移'
    if (groupType === 'LoadBalance') return '负载均衡'
    return groupType
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.4, 
        delay: index * 0.1,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      className="rounded-2xl overflow-hidden cursor-default"
      style={{
        border: `3px solid ${colorConfig.border}`,
        background: colorConfig.bg,
        minWidth: '220px',
        maxWidth: '240px',
        boxShadow: `0 0 20px ${colorConfig.border}40`
      }}
    >
      <div className="p-6 flex flex-col items-center gap-5">
        {/* 图标 */}
        <div 
          className="p-5 rounded-2xl"
          style={{ 
            background: colorConfig.iconBg,
            boxShadow: `0 0 20px ${colorConfig.border}60`
          }}
        >
          <Icon 
            className="text-4xl" 
            style={{ color: colorConfig.icon }}
          />
        </div>
        
        {/* 主标题 */}
        <div className="text-center w-full">
          <div 
            className="font-bold text-xl px-1 break-words" 
            style={{ 
              color: colorConfig.text,
              textShadow: '0 0 10px rgba(0,0,0,0.5)',
              lineHeight: '1.3'
            }}
            title={groupInfo?.activeNode || name}
          >
            {groupInfo?.activeNode || name || title}
          </div>
          
          {/* 副标题：类型描述 */}
          {getTypeLabel() && (
            <div 
              className="text-base mt-2 font-medium"
              style={{ color: colorConfig.textSecondary }}
            >
              {getTypeLabel()}
            </div>
          )}
        </div>
        
        {/* 节点数量标签 */}
        {groupInfo?.isGroup && groupInfo.nodeCount !== undefined && (
          <div 
            className="px-5 py-2 rounded-full text-base font-semibold"
            style={{ 
              background: colorConfig.iconBg,
              border: `2px solid ${colorConfig.border}60`,
              color: colorConfig.text
            }}
          >
            {groupInfo.nodeCount} 节点
          </div>
        )}
      </div>
    </motion.div>
  )
})

NodeCard.displayName = 'NodeCard'

// ConnectionLine 移到组件外部
const ConnectionLine: React.FC<{ delay: number; index?: number }> = React.memo(({ delay, index = 0 }) => (
  <motion.div 
    initial={{ opacity: 0, scaleX: 0 }}
    animate={{ opacity: 1, scaleX: 1 }}
    transition={{ duration: 0.5, delay: index * 0.1 + 0.2 }}
    className="relative w-20 h-1 mx-2"
  >
    <div 
      className="absolute inset-0 rounded-full"
      style={{ background: 'linear-gradient(90deg, rgba(6,182,212,0.3), rgba(16,185,129,0.3))' }}
    />
    <motion.div
      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
      style={{
        background: 'linear-gradient(90deg, #06b6d4, #10b981)',
        boxShadow: '0 0 10px rgba(6, 182, 212, 0.8)'
      }}
      animate={{ left: ['0%', '100%'] }}
      transition={{ 
        repeat: Infinity, 
        duration: 1.5, 
        ease: 'easeInOut',
        delay: delay
      }}
    />
  </motion.div>
))

ConnectionLine.displayName = 'ConnectionLine'

// ScaleWrapper 优化避免无限刷新
const ScaleWrapper: React.FC<{ children: React.ReactNode }> = React.memo(({ children }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const scaleRef = useRef(scale)

  useLayoutEffect(() => {
    const updateScale = () => {
      if (containerRef.current && contentRef.current) {
        const containerWidth = containerRef.current.clientWidth
        const contentWidth = contentRef.current.scrollWidth
        const newScale = containerWidth < contentWidth ? (containerWidth - 40) / contentWidth : 1
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
    <div ref={containerRef} className="w-full flex justify-center">
      <div 
        ref={contentRef} 
        style={{ transform: `scale(${scale})` }} 
        className="origin-center transition-transform duration-300 ease-out"
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
      size="4xl"
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex justify-between items-center pr-4">
          <div className="flex items-center gap-2">
            <MdLink className="text-lg text-primary" />
            <span>链路预览</span>
            <span className="text-xs font-normal text-default-400 ml-2">
              节点总数: {chains.length}
            </span>
          </div>
          <Button isIconOnly size="sm" variant="light" onPress={onClose}>
            <IoClose className="text-lg" />
          </Button>
        </ModalHeader>
        <ModalBody className="py-6 min-h-[400px] flex flex-col">
          {chains.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-default-400">
              <TbPlugConnected className="text-5xl mb-4 opacity-50" />
              <p>暂无配置的代理链</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm font-medium text-foreground whitespace-nowrap">选择链路</span>
                <Select
                  size="sm"
                  className="max-w-xs"
                  selectedKeys={selectedChainId ? new Set([selectedChainId]) : new Set()}
                  onSelectionChange={(keys) => {
                    const id = Array.from(keys)[0] as string
                    setSelectedChainId(id)
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
                  className="flex-1 rounded-3xl p-10 flex items-center justify-center relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(30, 41, 59, 0.6))',
                    border: '1px solid rgba(71, 85, 105, 0.3)'
                  }}
                >
                  <div 
                    className="absolute inset-0 opacity-[0.05]" 
                    style={{ 
                      backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
                      backgroundSize: '30px 30px' 
                    }} 
                  />

                  <div className="flex items-center w-full justify-center overflow-hidden py-4">
                    <ScaleWrapper>
                      <div className="flex items-center gap-2 px-8 min-w-max">
                        <NodeCard 
                          icon={IoPerson} 
                          title="用户" 
                          name="本机"
                          color="indigo"
                          index={0}
                        />

                        <ConnectionLine delay={0} index={0} />

                        <NodeCard 
                          icon={TbServer} 
                          title="前置节点" 
                          name={selectedChain.dialerProxy}
                          color="cyan"
                          index={1}
                          groupInfo={getGroupInfo(selectedChain.dialerProxy)}
                        />

                        <ConnectionLine delay={0.3} index={1} />

                        <NodeCard 
                          icon={TbServer} 
                          title="落地节点" 
                          name={selectedChain.targetProxy}
                          color="orange"
                          index={2}
                          groupInfo={getGroupInfo(selectedChain.targetProxy)}
                        />

                        <ConnectionLine delay={0.6} index={2} />

                        <NodeCard 
                          icon={IoGlobeOutline} 
                          title="互联网" 
                          name={selectedChain.targetGroups?.join(', ') || 'Direct'}
                          color="emerald"
                          index={3}
                          groupInfo={getGroupInfo(selectedChain.targetGroups?.[0])}
                        />
                      </div>
                    </ScaleWrapper>
                  </div>
                  
                  {/* 图例说明 */}
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                    <div 
                      className="flex gap-4 px-4 py-2 rounded-full"
                      style={{
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid rgba(71, 85, 105, 0.4)'
                      }}
                    >
                      {[
                        { color: COLORS.indigo.border, label: '用户' },
                        { color: COLORS.cyan.border, label: '前置节点' },
                        { color: COLORS.orange.border, label: '落地节点' },
                        { color: COLORS.emerald.border, label: '互联网' }
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <span 
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ background: item.color }}
                          />
                          <span className="text-xs text-default-400">{item.label}</span>
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
