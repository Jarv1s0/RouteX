import { Card, CardBody } from '@heroui/react'
import React from 'react'

const RuleItem: React.FC<ControllerRulesDetail & { index: number }> = (props) => {
  const { type, payload, proxy, index } = props

  const getProxyColor = (proxy: string): string => {
    if (proxy === 'REJECT') return 'text-red-500'
    if (proxy === 'DIRECT') return 'text-black dark:text-white'
    if (proxy === 'Proxy') return 'text-orange-500'
    return 'text-blue-500'
  }

  return (
    <div className={`w-full px-2 pb-1 ${index === 0 ? 'pt-2' : ''}`}>
      <Card>
        <CardBody className="w-full py-2">
          <div className="flex items-center gap-2">
            {/* 序号 */}
            <span className="text-foreground-400 text-sm w-5 flex-shrink-0">
              {index + 1}
            </span>
            {/* 规则名称 */}
            <span
              title={payload}
              className="text-ellipsis whitespace-nowrap overflow-hidden"
            >
              {payload}
            </span>
            {/* 类型 */}
            <span className="text-foreground-400 text-sm flex-shrink-0">
              {type}
            </span>
            {/* 代理组 - 固定位置左对齐 */}
            <span className={`ml-auto w-35 flex-shrink-0 ${getProxyColor(proxy)}`}>
              {proxy}
            </span>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

export default RuleItem
