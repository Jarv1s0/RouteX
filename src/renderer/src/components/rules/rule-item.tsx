import { Card, CardBody, Chip, Switch } from '@heroui/react'
import React from 'react'
import { useGroups } from '@renderer/hooks/use-groups'

interface RuleItemProps extends ControllerRulesDetail {
  index: number
  enabled?: boolean
  onToggle?: () => void
}

const RuleItem: React.FC<RuleItemProps> = (props) => {
  const { type, payload, proxy, index, enabled = true, onToggle } = props
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
    <div className={`w-full px-2 pb-2 ${!enabled ? 'opacity-50' : ''}`}>
      <Card
        shadow="sm"
        radius="lg"
        className={`bg-default-100/60 dark:bg-default-50/30 backdrop-blur-md border border-default-200/60 dark:border-white/10 hover:bg-default-200/60 dark:hover:bg-default-100/40 hover:-translate-y-0.5 hover:shadow-md transition-all ${!enabled ? 'grayscale' : ''}`}
      >
        <CardBody className="w-full py-2 px-3">
          <div className="flex items-center gap-2">
            {/* 开关按钮 */}
            {onToggle && (
              <Switch
                size="sm"
                isSelected={enabled}
                onValueChange={() => onToggle()}
                classNames={{
                  wrapper: "w-8 h-4",
                  thumb: "w-3 h-3"
                }}
              />
            )}
            {/* 序号 */}
            <span className={`text-foreground-400 text-xs w-6 flex-shrink-0 -mr-1 ${!enabled ? 'line-through' : ''}`}>
              {index + 1}.
            </span>
            {/* 类型 */}
            <Chip
              size="sm"
              variant="flat"
              color="default"
              classNames={{ content: "text-xs" }}
            >
              {type === 'PROCESS-NAME-WILDCARD' ? 'PROC-NAME-WILD' : type === 'PROCESS-PATH-WILDCARD' ? 'PROC-PATH-WILD' : type}
            </Chip>
            {/* 规则名称 */}
            <span
              title={payload}
              className={`text-sm font-medium text-ellipsis whitespace-nowrap overflow-hidden flex-1 min-w-0 ${!enabled ? 'line-through text-default-400' : ''}`}
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
                    className="bg-primary/10 text-primary border border-primary/20"
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
