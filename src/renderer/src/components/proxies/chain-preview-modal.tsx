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

// 高亮度饱和颜色配置 - 更明亮醒目
const COLORS = {
  indigo: {
    border: '#818CF8',
    bg: 'rgba(129, 140, 248, 0.25)',
    text: '#FFFFFF',
    textSecondary: '#C7D2FE',
    icon: '#FFFFFF',
    iconBg: 'rgba(129, 140, 248, 0.5)',
    glow: 'rgba(129, 140, 248, 0.6)'
  },
  cyan: {
    border: '#22D3EE',
    bg: 'rgba(34, 211, 238, 0.25)',
    text: '#FFFFFF',
    textSecondary: '#A5F3FC',
    icon: '#FFFFFF',
    iconBg: 'rgba(34, 211, 238, 0.5)',
    glow: 'rgba(34, 211, 238, 0.6)'
  },
  orange: {
    border: '#FB923C',
    bg: 'rgba(251, 146, 60, 0.25)',
    text: '#FFFFFF',
    textSecondary: '#FED7AA',
    icon: '#FFFFFF',
    iconBg: 'rgba(251, 146, 60, 0.5)',
    glow: 'rgba(251, 146, 60, 0.6)'
  },
  emerald: {
    border: '#34D399',
    bg: 'rgba(52, 211, 153, 0.25)',
    text: '#FFFFFF',
    textSecondary: '#A7F3D0',
    icon: '#FFFFFF',
    iconBg: 'rgba(52, 211, 153, 0.5)',
    glow: 'rgba(52, 211, 153, 0.6)'
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
  targetGroups?: string[]  // 新增：用于互联网卡片显示策略组
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
  targetGroups,
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
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.4, 
        delay: index * 0.1,
        ease: 'easeOut'
      }}
      whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
      className="rounded-3xl overflow-hidden cursor-default"
      style={{
        border: `2px solid ${colorConfig.border}`,
        background: `linear-gradient(160deg, ${colorConfig.bg}, rgba(15,23,42,0.8))`,
        minWidth: '200px',
        maxWidth: '220px',
        boxShadow: `0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)`
      }}
    >
      <div className="p-8 flex flex-col items-center gap-6">
        {/* 图标 */}
        <div 
          className="p-6 rounded-2xl"
          style={{ 
            background: colorConfig.iconBg,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <Icon 
            className="text-5xl" 
            style={{ color: colorConfig.icon }}
          />
        </div>
        
        {/* 主标题 */}
        <div className="text-center w-full">
          <div 
            className="font-bold text-2xl px-2 break-words" 
            style={{ 
              color: colorConfig.text,
              textShadow: `0 0 15px ${colorConfig.glow}, 0 2px 4px rgba(0,0,0,0.5)`,
              lineHeight: '1.4'
            }}
            title={groupInfo?.activeNode || name}
          >
            {groupInfo?.activeNode || name || title}
          </div>
          
          {/* 副标题：类型描述 */}
          {getTypeLabel() && (
            <div 
              className="text-xl mt-3 font-medium"
              style={{ color: colorConfig.textSecondary }}
            >
              {getTypeLabel()}
            </div>
          )}
        </div>
        
        {/* 策略组标签（互联网卡片）或节点数量标签 */}
        {targetGroups && targetGroups.length > 0 ? (
          <motion.div 
            className="px-6 py-3 rounded-2xl text-lg font-semibold text-center"
            style={{ 
              background: colorConfig.iconBg,
              border: `2px solid ${colorConfig.border}`,
              color: colorConfig.text,
              boxShadow: '0 6px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
            }}
            whileHover={{ scale: 1.03 }}
          >
            <div className="text-sm opacity-70 mb-1.5">应用到策略组</div>
            <div className="text-base font-bold" title={targetGroups.join(', ')}>
              {targetGroups.join(', ')}
            </div>
          </motion.div>
        ) : groupInfo?.isGroup && groupInfo.nodeCount !== undefined && (
          <motion.div 
            className="px-6 py-3 rounded-full text-lg font-bold"
            style={{ 
              background: colorConfig.iconBg,
              border: `2px solid ${colorConfig.border}`,
              color: colorConfig.text,
              boxShadow: '0 6px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
            }}
            whileHover={{ scale: 1.05 }}
          >
            {groupInfo.nodeCount} 节点
          </motion.div>
        )}
      </div>
    </motion.div>
  )
})

NodeCard.displayName = 'NodeCard'

// ConnectionLine - 双粒子流动效果
const ConnectionLine: React.FC<{ delay: number; index?: number }> = React.memo(({ delay, index = 0 }) => (
  <motion.div 
    initial={{ opacity: 0, scaleX: 0 }}
    animate={{ opacity: 1, scaleX: 1 }}
    transition={{ duration: 0.6, delay: index * 0.15 + 0.2 }}
    className="relative w-28 h-2 mx-6"
  >
    {/* 轨道背景 */}
    <div 
      className="absolute inset-0 rounded-full"
      style={{ 
        background: 'linear-gradient(90deg, rgba(34,211,238,0.3), rgba(52,211,153,0.3))'
      }}
    />
    
    {/* 流动粒子1 - 主粒子 */}
    <motion.div
      className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full"
      style={{
        background: 'radial-gradient(circle, #22D3EE 30%, #34D399 100%)'
      }}
      animate={{ left: ['-10%', '100%'] }}
      transition={{ 
        repeat: Infinity, 
        duration: 1.8, 
        ease: 'easeInOut',
        delay: delay
      }}
    />
    
    {/* 流动粒子2 - 次粒子 */}
    <motion.div
      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
      style={{
        background: 'radial-gradient(circle, #34D399 30%, #22D3EE 100%)'
      }}
      animate={{ left: ['-5%', '105%'] }}
      transition={{ 
        repeat: Infinity, 
        duration: 1.8, 
        ease: 'easeInOut',
        delay: delay + 0.9
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
    <div ref={containerRef} className="w-full flex justify-center overflow-visible">
      <div 
        ref={contentRef} 
        style={{ transform: `scale(${scale})`, padding: '20px' }} 
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
                  className="flex-1 rounded-3xl p-12 flex items-center justify-center relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.95), rgba(51, 65, 85, 0.8), rgba(30, 41, 59, 0.9))',
                    border: '1px solid rgba(148, 163, 184, 0.25)',
                    boxShadow: 'inset 0 0 60px rgba(0,0,0,0.3), 0 0 40px rgba(34, 211, 238, 0.1)'
                  }}
                >
                  {/* 动态网格背景 */}
                  <motion.div 
                    className="absolute inset-0" 
                    style={{ 
                      backgroundImage: 'radial-gradient(circle, rgba(148, 163, 184, 0.15) 1.5px, transparent 1.5px)',
                      backgroundSize: '35px 35px' 
                    }}
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  
                  {/* 背景光晕效果 */}
                  <div 
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%]"
                    style={{
                      background: 'radial-gradient(ellipse at center, rgba(34, 211, 238, 0.08) 0%, transparent 50%)'
                    }}
                  />

                  <div className="flex items-center w-full justify-center overflow-visible py-6 relative z-10">
                    <ScaleWrapper>
                      <div className="flex items-center gap-4 px-12 min-w-max">
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
                          name="目标网站"
                          color="emerald"
                          index={3}
                          targetGroups={selectedChain.targetGroups}
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
