import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Card, Avatar } from '@heroui/react'

const TOPOLOGY_NODE_SURFACE =
  'bg-default-100/70 dark:bg-default-50/30 backdrop-blur-md hover:bg-default-200/70 dark:hover:bg-default-100/45'

interface ThemeClasses {
    hex: string
    text: string
    ring: string
    shadow: string
    bg: string
    badgeShadow: string
}

interface SourceNodeData extends Record<string, unknown> {
    name: string
    displayIcon?: boolean
    iconUrl?: string
    uploadSpeed?: number
    downloadSpeed?: number
    count?: number
}

interface NamedNodeData extends Record<string, unknown> {
    name: string
}

interface ExitNodeData extends NamedNodeData {
    uploadSpeed?: number
    downloadSpeed?: number
    policyGroups?: Set<string>
}

const createThemeClasses = (
    hex: string,
    text: string,
    ring: string,
    shadow: string,
    bg: string,
    badgeShadow: string
): ThemeClasses => ({
    hex,
    text,
    ring,
    shadow,
    bg,
    badgeShadow
})

// Common function
const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const getThemeClasses = (name: string, defaultColor: string): ThemeClasses => {
    if (!name) return createThemeClasses(defaultColor, '', '', '', '', '')
    
    const upper = name.toUpperCase()
    if (upper.includes('DIRECT')) return createThemeClasses('#22c55e', 'text-green-600 dark:text-green-400', 'border-green-500/50', 'shadow-[0_4px_16px_rgba(34,197,94,0.15)]', 'bg-green-500', 'shadow-[0_4px_12px_rgba(34,197,94,0.3)]')
    if (upper.includes('REJECT')) return createThemeClasses('#ef4444', 'text-red-600 dark:text-red-400', 'border-red-500/50', 'shadow-[0_4px_16px_rgba(239,68,68,0.15)]', 'bg-red-500', 'shadow-[0_4px_12px_rgba(239,68,68,0.3)]')
    if (
        upper.includes('PROXY') || 
        upper.includes('香港') || upper.includes('HK') || upper.includes('HONG KONG') || 
        upper.includes('美国') || upper.includes('US') || upper.includes('UNITED STATES') || 
        upper.includes('日本') || upper.includes('JP') || upper.includes('JAPAN') || 
        upper.includes('台湾') || upper.includes('TW') || upper.includes('TAIWAN') || 
        upper.includes('狮城') || upper.includes('新加坡') || upper.includes('SG') || upper.includes('SINGAPORE') || 
        upper.includes('韩国') || upper.includes('KR') || upper.includes('KOREA') || 
        upper.includes('节点')
    ) return createThemeClasses('#f59e0b', 'text-amber-600 dark:text-amber-400', 'border-amber-500/50', 'shadow-[0_4px_16px_rgba(245,158,11,0.15)]', 'bg-amber-500', 'shadow-[0_4px_12px_rgba(245,158,11,0.3)]')
    if (upper.includes('AI') || upper.includes('GPT') || upper.includes('CLAUDE')) return createThemeClasses('#a855f7', 'text-purple-600 dark:text-purple-400', 'border-purple-500/50', 'shadow-[0_4px_16px_rgba(168,85,247,0.15)]', 'bg-purple-500', 'shadow-[0_4px_12px_rgba(168,85,247,0.3)]')
    if (upper.includes('GOOGLE') || upper.includes('YOUTUBE')) return createThemeClasses('#3b82f6', 'text-blue-600 dark:text-blue-400', 'border-blue-500/50', 'shadow-[0_4px_16px_rgba(59,130,246,0.15)]', 'bg-blue-500', 'shadow-[0_4px_12px_rgba(59,130,246,0.3)]')
    if (upper.includes('APPLE')) return createThemeClasses('#64748b', 'text-slate-600 dark:text-slate-400', 'border-slate-500/50', 'shadow-[0_4px_16px_rgba(100,116,139,0.15)]', 'bg-slate-500', 'shadow-[0_4px_12px_rgba(100,116,139,0.3)]')
    if (upper.includes('TELEGRAM')) return createThemeClasses('#0ea5e9', 'text-sky-600 dark:text-sky-400', 'border-sky-500/50', 'shadow-[0_4px_16px_rgba(14,165,233,0.15)]', 'bg-sky-500', 'shadow-[0_4px_12px_rgba(14,165,233,0.3)]')
    if (upper.includes('NETFLIX') || upper.includes('SPOTIFY')) return createThemeClasses('#f43f5e', 'text-rose-600 dark:text-rose-400', 'border-rose-500/50', 'shadow-[0_4px_16px_rgba(244,63,94,0.15)]', 'bg-rose-500', 'shadow-[0_4px_12px_rgba(244,63,94,0.3)]')
    if (upper.includes('GITHUB') || upper.includes('MICROSOFT')) return createThemeClasses('#06b6d4', 'text-cyan-600 dark:text-cyan-400', 'border-cyan-500/50', 'shadow-[0_4px_16px_rgba(6,182,212,0.15)]', 'bg-cyan-500', 'shadow-[0_4px_12px_rgba(6,182,212,0.3)]')
    
    // Default colors mapped by base defaults
    if (defaultColor === '#8b5cf6') return createThemeClasses(defaultColor, 'text-violet-600 dark:text-violet-400', 'border-violet-500/50', 'shadow-[0_4px_16px_rgba(139,92,246,0.15)]', 'bg-violet-500', 'shadow-[0_4px_12px_rgba(139,92,246,0.3)]')
    if (defaultColor === '#3b82f6') return createThemeClasses(defaultColor, 'text-blue-600 dark:text-blue-400', 'border-blue-500/50', 'shadow-[0_4px_16px_rgba(59,130,246,0.15)]', 'bg-blue-500', 'shadow-[0_4px_12px_rgba(59,130,246,0.3)]')
    if (defaultColor === '#10b981') return createThemeClasses(defaultColor, 'text-emerald-600 dark:text-emerald-400', 'border-emerald-500/80', 'shadow-[0_0_24px_rgba(16,185,129,0.25)]', 'bg-emerald-500', 'shadow-[0_4px_12px_rgba(16,185,129,0.3)]')
    
    return createThemeClasses(defaultColor, 'text-default-800 dark:text-default-100', 'border-default-500/50', 'shadow-sm', 'bg-default-500', 'shadow-md')
}

export const SourceNode = memo(function SourceNode({ data }: NodeProps) {
    const { name, displayIcon, iconUrl, uploadSpeed = 0, downloadSpeed = 0, count = 0 } = data as SourceNodeData

    return (
        <Card className={`w-[240px] h-[80px] ${TOPOLOGY_NODE_SURFACE} border-1.5 border-sky-400/50 shadow-[0_4px_20px_rgba(14,165,233,0.15)] relative overflow-visible p-2 transition-all`} radius="md">
            {count > 0 && (
                 <div className="absolute -top-3 -right-3 bg-sky-500 text-white text-[11px] font-semibold tracking-wider px-2 py-0.5 rounded-full z-10 shadow-md">
                    {count}
                 </div>
            )}
            
            <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 !bg-primary border-none" />
            
            <div className="p-1 flex flex-col items-center justify-center h-full w-full relative">
                {displayIcon && iconUrl && (
                     <Avatar size="sm" radius="md" src={iconUrl} className="bg-transparent absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 opacity-80" />
                )}
                
                <div className="flex-1 w-full flex flex-col justify-center items-center text-center px-4">
                    <div className="font-semibold tracking-wide text-[16px] truncate text-default-900 dark:text-default-100 w-full max-w-[200px]" title={name}>{name}</div>
                    <div className="flex gap-4 mt-1.5 justify-center w-full">
                        <span className="text-[11px] font-medium tracking-wide tabular-nums" style={{ color: '#0ea5e9' }}>↓ {formatBytes(downloadSpeed)}/s</span>
                        <span className="text-[11px] font-medium tracking-wide tabular-nums" style={{ color: '#c084fc' }}>↑ {formatBytes(uploadSpeed)}/s</span>
                    </div>
                </div>
            </div>
        </Card>
    )
})

export const RuleNode = memo(function RuleNode({ data }: NodeProps) {
    const { name } = data as NamedNodeData
    const theme = getThemeClasses(name, '#8b5cf6')
    const color = theme.hex
    
    return (
        <Card className={`w-[180px] h-[56px] ${TOPOLOGY_NODE_SURFACE} ${theme.shadow} relative px-3 py-2 outline-none border-1.5 ${theme.ring} transition-all`} 
              radius="md">
            <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 border-none" style={{ background: color }} />
            <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 border-none" style={{ background: color }} />
            
            <div className="flex items-center justify-center h-full">
                <div className={`font-semibold tracking-wide text-[16px] ${theme.text} truncate max-w-full`} title={name}>
                    {name}
                </div>
            </div>
        </Card>
    )
})

export const GroupNode = memo(function GroupNode({ data }: NodeProps) {
    const { name } = data as NamedNodeData
    const theme = getThemeClasses(name, '#3b82f6')
    const color = theme.hex
    
    return (
        <Card className={`w-[180px] h-[56px] ${TOPOLOGY_NODE_SURFACE} ${theme.shadow} relative px-3 py-2 outline-none border-1.5 ${theme.ring} transition-all`} 
              radius="md">
            <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 border-none" style={{ background: color }} />
            <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 border-none" style={{ background: color }} />
            
            <div className="flex items-center justify-center gap-2 h-full">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }}></div>
                <div className={`font-semibold tracking-wide text-[16px] ${theme.text} truncate max-w-[120px]`} title={name}>
                    {name}
                </div>
            </div>
        </Card>
    )
})

export const ExitNode = memo(function ExitNode({ data }: NodeProps) {
    const { name, uploadSpeed = 0, downloadSpeed = 0, policyGroups } = data as ExitNodeData
    const color = '#10b981' // Emerald-500
    
    let groupText = 'PROXY'
    if (policyGroups && policyGroups.size > 0) {
        groupText = Array.from(policyGroups).join(' + ')
    }
    
    return (
        <div className="relative pt-4">
             <div className="absolute top-0 left-1/2 transform -translate-x-1/2 bg-emerald-500 text-white text-[11px] font-semibold px-3 py-0.5 rounded-sm z-10 shadow-[0_4px_12px_rgba(16,185,129,0.3)] tracking-[0.1em] truncate max-w-[200px]" title={groupText}>
                {groupText}
             </div>
             
             <Card className={`w-[230px] h-[76px] ${TOPOLOGY_NODE_SURFACE} shadow-[0_0_24px_rgba(16,185,129,0.25)] border-2 border-emerald-500/80 relative overflow-visible rounded-full p-2 transition-all`} 
                   radius="lg">
                <Handle type="target" position={Position.Left} className="w-3 h-3 border-none" style={{ background: color }} />
                
                <div className="py-2 px-4 flex flex-col gap-1.5 items-center justify-center h-full">
                    <div className="font-bold tracking-wide text-[17px] flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse border border-white/50"></div>
                        <span className="truncate max-w-[170px]" title={name}>{name}</span>
                    </div>
                    <div className="flex gap-4 mt-0.5">
                        <span className="text-[11px] font-medium tracking-wide tabular-nums text-emerald-600 dark:text-emerald-300 opacity-80">↓ {formatBytes(downloadSpeed || 0)}/s</span>
                        <span className="text-[11px] font-medium tracking-wide tabular-nums text-emerald-600 dark:text-emerald-300 opacity-80">↑ {formatBytes(uploadSpeed || 0)}/s</span>
                    </div>
                </div>
            </Card>
        </div>
    )
})

export const nodeTypes = {
    source: SourceNode,
    rule: RuleNode,
    chain: GroupNode,
    exit: ExitNode
}
