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
        <CardBody className="w-full">
          <div title={payload} className="text-ellipsis whitespace-nowrap overflow-hidden text-black dark:text-white">
            {payload}
          </div>
          <div className="flex justify-start text-foreground-500">
            <div>{type}</div>
            <div className={`ml-2 ${getProxyColor(proxy)}`}>{proxy}</div>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

export default RuleItem
