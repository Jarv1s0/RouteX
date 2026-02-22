import { memo } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { Card, Avatar } from '@heroui/react'

// Common function
const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const getThemeClasses = (name: string, defaultColor: string) => {
    if (!name) return { hex: defaultColor, text: '', ring: '', shadow: '', bg: '' }
    
    const upper = name.toUpperCase()
    if (upper.includes('DIRECT')) return { hex: '#22c55e', text: 'text-green-600 dark:text-green-400', ring: 'border-green-500/50', shadow: 'shadow-[0_4px_16px_rgba(34,197,94,0.15)]', bg: 'bg-green-500', badgeShadow: 'shadow-[0_4px_12px_rgba(34,197,94,0.3)]' }
    if (upper.includes('REJECT')) return { hex: '#ef4444', text: 'text-red-600 dark:text-red-400', ring: 'border-red-500/50', shadow: 'shadow-[0_4px_16px_rgba(239,68,68,0.15)]', bg: 'bg-red-500', badgeShadow: 'shadow-[0_4px_12px_rgba(239,68,68,0.3)]' }
    if (
        upper.includes('PROXY') || 
        upper.includes('香港') || upper.includes('HK') || upper.includes('HONG KONG') || 
        upper.includes('美国') || upper.includes('US') || upper.includes('UNITED STATES') || 
        upper.includes('日本') || upper.includes('JP') || upper.includes('JAPAN') || 
        upper.includes('台湾') || upper.includes('TW') || upper.includes('TAIWAN') || 
        upper.includes('狮城') || upper.includes('新加坡') || upper.includes('SG') || upper.includes('SINGAPORE') || 
        upper.includes('韩国') || upper.includes('KR') || upper.includes('KOREA') || 
        upper.includes('节点')
    ) return { hex: '#f59e0b', text: 'text-amber-600 dark:text-amber-400', ring: 'border-amber-500/50', shadow: 'shadow-[0_4px_16px_rgba(245,158,11,0.15)]', bg: 'bg-amber-500', badgeShadow: 'shadow-[0_4px_12px_rgba(245,158,11,0.3)]' }
    if (upper.includes('AI') || upper.includes('GPT') || upper.includes('CLAUDE')) return { hex: '#a855f7', text: 'text-purple-600 dark:text-purple-400', ring: 'border-purple-500/50', shadow: 'shadow-[0_4px_16px_rgba(168,85,247,0.15)]', bg: 'bg-purple-500', badgeShadow: 'shadow-[0_4px_12px_rgba(168,85,247,0.3)]' }
    if (upper.includes('GOOGLE') || upper.includes('YOUTUBE')) return { hex: '#3b82f6', text: 'text-blue-600 dark:text-blue-400', ring: 'border-blue-500/50', shadow: 'shadow-[0_4px_16px_rgba(59,130,246,0.15)]', bg: 'bg-blue-500', badgeShadow: 'shadow-[0_4px_12px_rgba(59,130,246,0.3)]' }
    if (upper.includes('APPLE')) return { hex: '#64748b', text: 'text-slate-600 dark:text-slate-400', ring: 'border-slate-500/50', shadow: 'shadow-[0_4px_16px_rgba(100,116,139,0.15)]', bg: 'bg-slate-500', badgeShadow: 'shadow-[0_4px_12px_rgba(100,116,139,0.3)]' }
    if (upper.includes('TELEGRAM')) return { hex: '#0ea5e9', text: 'text-sky-600 dark:text-sky-400', ring: 'border-sky-500/50', shadow: 'shadow-[0_4px_16px_rgba(14,165,233,0.15)]', bg: 'bg-sky-500', badgeShadow: 'shadow-[0_4px_12px_rgba(14,165,233,0.3)]' }
    if (upper.includes('NETFLIX') || upper.includes('SPOTIFY')) return { hex: '#f43f5e', text: 'text-rose-600 dark:text-rose-400', ring: 'border-rose-500/50', shadow: 'shadow-[0_4px_16px_rgba(244,63,94,0.15)]', bg: 'bg-rose-500', badgeShadow: 'shadow-[0_4px_12px_rgba(244,63,94,0.3)]' }
    if (upper.includes('GITHUB') || upper.includes('MICROSOFT')) return { hex: '#06b6d4', text: 'text-cyan-600 dark:text-cyan-400', ring: 'border-cyan-500/50', shadow: 'shadow-[0_4px_16px_rgba(6,182,212,0.15)]', bg: 'bg-cyan-500', badgeShadow: 'shadow-[0_4px_12px_rgba(6,182,212,0.3)]' }
    
    // Default colors mapped by base defaults
    if (defaultColor === '#8b5cf6') return { hex: defaultColor, text: 'text-violet-600 dark:text-violet-400', ring: 'border-violet-500/50', shadow: 'shadow-[0_4px_16px_rgba(139,92,246,0.15)]', bg: 'bg-violet-500', badgeShadow: 'shadow-[0_4px_12px_rgba(139,92,246,0.3)]' }
    if (defaultColor === '#3b82f6') return { hex: defaultColor, text: 'text-blue-600 dark:text-blue-400', ring: 'border-blue-500/50', shadow: 'shadow-[0_4px_16px_rgba(59,130,246,0.15)]', bg: 'bg-blue-500', badgeShadow: 'shadow-[0_4px_12px_rgba(59,130,246,0.3)]' }
    if (defaultColor === '#10b981') return { hex: defaultColor, text: 'text-emerald-600 dark:text-emerald-400', ring: 'border-emerald-500/80', shadow: 'shadow-[0_0_24px_rgba(16,185,129,0.25)]', bg: 'bg-emerald-500', badgeShadow: 'shadow-[0_4px_12px_rgba(16,185,129,0.3)]' }
    
    return { hex: defaultColor, text: 'text-default-800 dark:text-default-100', ring: 'border-default-500/50', shadow: 'shadow-sm', bg: 'bg-default-500', badgeShadow: 'shadow-md' }
}

export const SourceNode = memo(function SourceNode({ data }: NodeProps) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { name, displayIcon, iconUrl, uploadSpeed, downloadSpeed, count } = data as any

    return (
        <Card className="w-[240px] h-[80px] bg-slate-50 dark:bg-slate-800 border-1.5 border-sky-400/50 shadow-[0_4px_20px_rgba(14,165,233,0.15)] relative overflow-visible p-2 transition-all hover:bg-slate-100 dark:hover:bg-slate-700" radius="md">
            {count > 0 && (
                 <div className="absolute -top-3 -right-3 bg-sky-500 text-white text-[13px] font-bold px-2 py-0.5 rounded-full z-10 shadow-md">
                    {count}
                 </div>
            )}
            
            <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 !bg-primary border-none" />
            
            <div className="p-1 flex flex-col items-center justify-center h-full w-full relative">
                {displayIcon && iconUrl && (
                     <Avatar size="sm" radius="md" src={iconUrl} className="bg-transparent absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 opacity-80" />
                )}
                
                <div className="flex-1 w-full flex flex-col justify-center items-center text-center px-4">
                    <div className="font-extrabold text-[17px] truncate text-default-900 dark:text-default-100 w-full max-w-[200px]" title={name}>{name}</div>
                    <div className="flex gap-4 mt-1.5 justify-center w-full">
                        <span className="text-[13px] font-bold" style={{ color: '#0ea5e9' }}>↓ {formatBytes(downloadSpeed)}/s</span>
                        <span className="text-[13px] font-bold" style={{ color: '#c084fc' }}>↑ {formatBytes(uploadSpeed)}/s</span>
                    </div>
                </div>
            </div>
        </Card>
    )
})

export const RuleNode = memo(function RuleNode({ data }: NodeProps) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { name } = data as any
    const theme = getThemeClasses(name, '#8b5cf6')
    const color = theme.hex
    
    return (
        <Card className={`w-[180px] h-[56px] bg-slate-50 dark:bg-slate-800 ${theme.shadow} relative px-3 py-2 outline-none border-1.5 ${theme.ring} transition-all hover:bg-slate-100 dark:hover:bg-slate-700`} 
              radius="md">
            <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 border-none" style={{ background: color }} />
            <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 border-none" style={{ background: color }} />
            
            <div className="flex items-center justify-center h-full">
                <div className={`font-extrabold text-[18px] ${theme.text} truncate max-w-full`} title={name}>
                    {name}
                </div>
            </div>
        </Card>
    )
})

export const GroupNode = memo(function GroupNode({ data }: NodeProps) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { name } = data as any
    const theme = getThemeClasses(name, '#3b82f6')
    const color = theme.hex
    
    return (
        <Card className={`w-[180px] h-[56px] bg-slate-50 dark:bg-slate-800 ${theme.shadow} relative px-3 py-2 outline-none border-1.5 ${theme.ring} transition-all hover:bg-slate-100 dark:hover:bg-slate-700`} 
              radius="md">
            <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 border-none" style={{ background: color }} />
            <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 border-none" style={{ background: color }} />
            
            <div className="flex items-center justify-center gap-2 h-full">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }}></div>
                <div className={`font-extrabold text-[18px] ${theme.text} truncate max-w-[120px]`} title={name}>
                    {name}
                </div>
            </div>
        </Card>
    )
})

export const ExitNode = memo(function ExitNode({ data }: NodeProps) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { name, uploadSpeed, downloadSpeed, policyGroups } = data as any
    const color = '#10b981' // Emerald-500
    
    let groupText = 'PROXY'
    if (policyGroups && policyGroups.size > 0) {
        groupText = Array.from(policyGroups).join(' + ')
    }
    
    return (
        <div className="relative pt-4">
             <div className="absolute top-0 left-1/2 transform -translate-x-1/2 bg-emerald-500 text-white text-[13px] font-bold px-3 py-0.5 rounded-sm z-10 shadow-[0_4px_12px_rgba(16,185,129,0.3)] tracking-wider truncate max-w-[200px]" title={groupText}>
                {groupText}
             </div>
             
             <Card className="w-[230px] h-[76px] bg-slate-50 dark:bg-slate-800 shadow-[0_0_24px_rgba(16,185,129,0.25)] border-2 border-emerald-500/80 relative overflow-visible rounded-full p-2 transition-all hover:bg-slate-100 dark:hover:bg-slate-700" 
                   radius="lg">
                <Handle type="target" position={Position.Left} className="w-3 h-3 border-none" style={{ background: color }} />
                
                <div className="py-2 px-4 flex flex-col gap-2 items-center justify-center h-full">
                    <div className="font-black text-[19px] flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse border border-white/50"></div>
                        <span className="truncate max-w-[170px]" title={name}>{name}</span>
                    </div>
                    <div className="flex gap-4 mt-0.5">
                        <span className="text-[13px] font-bold text-emerald-600 dark:text-emerald-300 opacity-80">↓ {formatBytes(downloadSpeed || 0)}/s</span>
                        <span className="text-[13px] font-bold text-emerald-600 dark:text-emerald-300 opacity-80">↑ {formatBytes(uploadSpeed || 0)}/s</span>
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
