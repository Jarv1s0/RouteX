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
    <div className={`w-full px-2 pb-2 ${index === 0 ? 'pt-2' : ''}`}>
      <Card>
        <CardBody className="w-full py-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 min-w-0 flex-1">
              {/* 序号 */}
              <div className="text-foreground-400 text-sm mt-0.5 flex-shrink-0 w-8">
                {index + 1}
              </div>
              
              {/* 规则信息 */}
              <div className="min-w-0 flex-1">
                {/* 规则名称 */}
                <div 
                  title={payload} 
                  className="text-ellipsis whitespace-nowrap overflow-hidden text-black dark:text-white font-medium"
                >
                  {payload}
                </div>
                {/* 规则类型 */}
                <div className="text-foreground-500 text-sm mt-1">{type}</div>
              </div>
            </div>
            
            {/* 代理组 - 最右边左对齐 */}
            <div className="flex-shrink-0 w-36 ml-4">
              <span className={`${getProxyColor(proxy)}`}>{proxy}</span>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

export default RuleItem
