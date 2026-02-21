import React from 'react'
import { Card, CardBody, ScrollShadow } from '@heroui/react'
import { IoGlobeOutline, IoArrowUp, IoArrowDown, IoServerOutline } from 'react-icons/io5'
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
      <div className="flex flex-col p-1">
        {details.map((hit) => {
          const formattedTime = (() => {
            const date = new Date(hit.time)
            return isNaN(date.getTime()) ? '-' : format(date, 'HH:mm:ss')
          })()

          return (
            <div key={hit.id || Math.random()} className="px-0.5 pb-1.5">
              <Card 
                as="div"
                shadow="sm"
                radius="lg"
                className={`w-full transition-all duration-200 border group
                  bg-white/60 dark:bg-[#18181b]/60 backdrop-blur-md 
                  border-default-200/50 dark:border-white/5
                  hover:bg-default-100/80 hover:shadow-md
                `}
              >

                <CardBody className="py-2 px-3">
                  {/* 第一行：标签 + 时间 + 流量 */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {/* 代理标签 */}
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-primary/30 text-primary bg-primary/10 flex items-center gap-1">
                        <IoServerOutline size={10} />
                        <span className="max-w-[100px] truncate">{hit.proxy}</span>
                      </span>
                      {/* 进程 */}
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-default/30 text-default-500 bg-default/10 flex items-center gap-1">
                        <RiAppsLine size={10} />
                        <span className="max-w-[80px] truncate">{hit.process ? hit.process.split('/').pop() : 'System'}</span>
                      </span>
                      {/* 时间 */}
                      <span className="text-default-400 text-[10px] font-mono tracking-tight">
                        {formattedTime}
                      </span>
                    </div>
                    {/* 流量 */}
                    <div className="flex items-center gap-2 text-[11px] font-mono font-medium">
                      <div className="flex items-center gap-0.5 text-cyan-500">
                        <IoArrowUp size={10} />
                        <span>{calcTraffic(hit.upload)}</span>
                      </div>
                      <div className="w-px h-2.5 bg-default-200" />
                      <div className="flex items-center gap-0.5 text-purple-500">
                        <IoArrowDown size={10} />
                        <span>{calcTraffic(hit.download)}</span>
                      </div>
                    </div>
                  </div>
                  {/* 第二行：主机地址 */}
                  <div className="flex items-center gap-1.5 select-text text-sm font-mono text-default-700 dark:text-default-300 break-all line-clamp-1 leading-relaxed">
                    <IoGlobeOutline size={14} className="text-default-400 shrink-0" />
                    <span title={hit.host}>{hit.host || 'Unknown Host'}</span>
                  </div>
                </CardBody>
              </Card>
            </div>
          )
        })}
      </div>
    </ScrollShadow>
  )
}

export default RuleDetailList
