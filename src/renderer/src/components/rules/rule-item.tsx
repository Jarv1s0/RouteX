import { Card, CardBody, Chip } from '@heroui/react'
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

  const getProxyColor = (proxy: string): 'danger' | 'default' | 'warning' | 'primary' => {
    if (proxy === 'REJECT') return 'danger'
    if (proxy === 'DIRECT') return 'default'
    if (proxy === 'Proxy') return 'warning'
    return 'primary'
  }

  return (
    <div className="w-full px-2 pb-2">
      <Card
        shadow="sm"
        radius="lg"
        className="bg-white/50 dark:bg-default-100/50 backdrop-blur-md hover:bg-white/80 dark:hover:bg-default-100/80 transition-all border border-transparent hover:border-default-200/50 shadow-sm"
      >
        <CardBody className="w-full py-2 px-3">
          <div className="flex items-center gap-2">
            {/* 序号 */}
            <span className="text-foreground-400 text-xs w-6 flex-shrink-0 -mr-1">
              {index + 1}.
            </span>
            {/* 类型 */}
            <Chip
              size="sm"
              variant="flat"
              color="default"
              classNames={{ content: "text-xs" }}
            >
              {type}
            </Chip>
            {/* 规则名称 */}
            <span
              title={payload}
              className="text-sm font-medium text-ellipsis whitespace-nowrap overflow-hidden flex-1 min-w-0"
            >
              {payload}
            </span>
            {/* 代理组和当前节点 */}
            <div className="flex items-center gap-1 flex-shrink-0 max-w-[300px]">
              <Chip
                size="sm"
                variant="flat"
                color={getProxyColor(proxy)}
                classNames={{ content: "text-xs" }}
              >
                {proxy}
              </Chip>
              {currentNode && currentNode !== proxy && (
                <>
                  <span className="text-foreground-300 text-xs">→</span>
                  <Chip
                    size="sm"
                    variant="flat"
                    classNames={{ content: "text-xs flag-emoji" }}
                    style={{ backgroundColor: 'rgba(5, 150, 105, 0.15)', color: 'rgb(5, 150, 105)' }}
                  >
                    {currentNode}
                  </Chip>
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
