import React from 'react'
import { ScrollShadow, Chip } from '@heroui/react'
import { IoTimeOutline, IoGlobeOutline, IoServerOutline, IoArrowUp, IoArrowDown } from 'react-icons/io5'
import { RiAppsLine } from 'react-icons/ri'
import { calcTraffic } from '@renderer/utils/calc'
import { format } from 'date-fns'

interface RuleHitDetail {
  id: string
  time: string
  host: string
  process: string
  proxy: string
  upload: number
  download: number
}

interface RuleDetailListProps {
  details: RuleHitDetail[]
}

const RuleDetailList: React.FC<RuleDetailListProps> = ({ details }) => {
  
  if (!details || details.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-[300px] text-foreground-400 gap-2">
            <div className="text-4xl opacity-20">📭</div>
            <span className="text-sm">暂无详细记录</span>
        </div>
    )
  }

  return (
    <ScrollShadow className="h-[400px] w-full">
      <div className="flex flex-col gap-2 p-1">
        {details.map((hit) => (
          <div 
            key={hit.id || Math.random()} 
            className="group flex items-center justify-between p-3 rounded-xl hover:bg-default-100/50 transition-all border border-transparent hover:border-default-200/50"
          >
            {/* Left: Host & Process info */}
            <div className="flex flex-col gap-1 min-w-0 flex-1 mr-4">
               {/* Host */}
               <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-primary/10 text-primary shrink-0">
                    <IoGlobeOutline size={14} />
                  </div>
                  <span className="font-semibold text-sm truncate select-text" title={hit.host}>
                    {hit.host || 'Unknown Host'}
                  </span>
               </div>
               
               {/* Meta Row: Process & Time */}
               <div className="flex items-center gap-3 text-xs text-foreground-400 pl-7">
                  <div className="flex items-center gap-1 max-w-[120px] truncate" title={hit.process}>
                    <RiAppsLine size={12} />
                    <span>{hit.process ? hit.process.split('/').pop() : 'System'}</span>
                  </div>
                  <div className="w-px h-3 bg-default-200" />
                  <div className="flex items-center gap-1">
                    <IoTimeOutline size={12} />
                    <span>
                      {(() => {
                        const date = new Date(hit.time)
                        return isNaN(date.getTime()) ? '-' : format(date, 'HH:mm:ss')
                      })()}
                    </span>
                  </div>
               </div>
            </div>

            {/* Right: Proxy & Traffic */}
            <div className="flex flex-col items-end gap-1 shrink-0">
               {/* Proxy Tag */}
               <Chip 
                  size="sm" 
                  variant="flat" 
                  classNames={{
                    base: "bg-default-100 group-hover:bg-background/80 h-6",
                    content: "text-[10px] font-medium text-foreground-500 flex gap-1 items-center px-2"
                  }}
               >
                  <IoServerOutline size={10} />
                  <span className="max-w-[80px] truncate">{hit.proxy}</span>
               </Chip>

               {/* Traffic Badge */}
               <div className="flex items-center gap-3 text-[10px] font-medium font-mono bg-default-50 px-2 py-0.5 rounded-md border border-default-100">
                  <div className="flex items-center gap-0.5 text-cyan-500">
                     <IoArrowUp size={10} />
                     <span>{calcTraffic(hit.upload)}</span>
                  </div>
                  <div className="w-px h-2 bg-default-200" />
                  <div className="flex items-center gap-0.5 text-purple-500">
                     <IoArrowDown size={10} />
                     <span>{calcTraffic(hit.download)}</span>
                  </div>
               </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollShadow>
  )
}

export default RuleDetailList
