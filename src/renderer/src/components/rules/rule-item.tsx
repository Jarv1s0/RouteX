import { Card, CardBody } from '@heroui/react'
import React from 'react'
import { useGroups } from '@renderer/hooks/use-groups'

const RuleItem: React.FC<ControllerRulesDetail & { index: number }> = (props) => {
  const { type, payload, proxy, index } = props
  const { groups = [] } = useGroups()

  // 递归查找最终节点
  const getFinalNode = (proxyName: string, visited: Set<string> = new Set()): string | null => {
    if (visited.has(proxyName)) return null
    visited.add(proxyName)
    
    const group = groups.find(g => g.name === proxyName)
    if (!group || !group.now) return null
    
    // 检查 now 是否也是一个代理组
    const subGroup = groups.find(g => g.name === group.now)
    if (subGroup) {
      return getFinalNode(group.now, visited)
    }
    
    return group.now
  }

  const currentNode = getFinalNode(proxy)

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
            <span className="text-foreground-400 text-sm w-6 flex-shrink-0">
              {index + 1}.
            </span>
            {/* 类型 */}
            <span className="text-foreground-400 text-sm flex-shrink-0">
              {type}
            </span>
            {/* 规则名称 */}
            <span
              title={payload}
              className="text-primary text-ellipsis whitespace-nowrap overflow-hidden flex-1 min-w-0"
            >
              {payload}
            </span>
            {/* 代理组和当前节点 */}
            <div className="flex items-center gap-1 flex-shrink-0 max-w-[300px]">
              <span className={getProxyColor(proxy)}>{proxy}</span>
              {currentNode && currentNode !== proxy && (
                <>
                  <span className="text-foreground-300">→</span>
                  <span className="flag-emoji truncate" style={{ color: 'rgb(5, 150, 105)' }} title={currentNode}>{currentNode}</span>
                </>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

export default RuleItem
