import { Card, CardBody, Chip, Switch } from '@heroui/react'
import React from 'react'
import { useGroups } from '@renderer/hooks/use-groups'

interface RuleItemProps extends ControllerRulesDetail {
  index: number
  displayIndex?: number
  enabled?: boolean
  onToggle?: () => void
}

const RuleItem: React.FC<RuleItemProps> = (props) => {
  const { type, payload, proxy, index, displayIndex = index + 1, enabled = true, onToggle } = props
  const { groups = [] } = useGroups()

  // 递归查找最终节点
  const getFinalNode = (proxyName: string, visited: Set<string> = new Set()): string | null => {
    if (visited.has(proxyName)) return null
    visited.add(proxyName)

    const group = groups.find((g) => g.name === proxyName)
    if (!group || !group.now) return null

    // 检查 now 是否也是一个代理组
    const subGroup = groups.find((g) => g.name === group.now)
    if (subGroup) {
      return getFinalNode(group.now, visited)
    }

    return group.now
  }

  const currentNode = getFinalNode(proxy)

  const getProxyColor = (proxy: string): 'danger' | 'success' | 'secondary' | 'primary' | 'warning' | 'default' => {
    if (proxy === 'REJECT') return 'danger'
    if (proxy === 'DIRECT') return 'default'
    return 'secondary'
  }

  return (
    <div className={`w-full px-2 pb-2 ${!enabled ? 'opacity-50' : ''}`}>
      <Card
        shadow="sm"
        radius="lg"
        className={`bg-default-100/60 dark:bg-default-50/30 backdrop-blur-md border border-default-200/60 dark:border-white/10 hover:bg-default-200/60 dark:hover:bg-default-100/40 hover:-translate-y-0.5 hover:shadow-md transition-all ${!enabled ? 'grayscale' : ''}`}
      >
        <CardBody className="w-full px-3 py-2">
          <div className="flex items-center gap-2">
            {onToggle && (
              <Switch
                size="sm"
                isSelected={enabled}
                onValueChange={() => onToggle()}
                classNames={{
                  wrapper: 'h-4 w-8',
                  thumb: 'h-3 w-3'
                }}
              />
            )}
            <span
              className={`w-6 flex-shrink-0 -mr-1 text-xs text-foreground-400 ${!enabled ? 'line-through' : ''}`}
            >
              {displayIndex}.
            </span>
            {/* 核心信息区：使用引导线(Leader Line)连接名称和策略，解决空洞感 */}
            <div className={`min-w-0 flex-1 flex items-center ${!enabled ? 'opacity-60 grayscale' : ''}`}>
              
              {/* 类型 + 名称 */}
              <div className="flex items-center gap-2 flex-shrink-0 min-w-0 max-w-[65%]">
                <Chip size="sm" variant="flat" color="default" classNames={{ content: 'text-xs' }} className="flex-shrink-0">
                  {type === 'PROCESS-NAME-WILDCARD'
                    ? 'PROC-NAME-WILD'
                    : type === 'PROCESS-PATH-WILDCARD'
                      ? 'PROC-PATH-WILD'
                      : type}
                </Chip>
                <div className="flex items-baseline gap-1.5 min-w-0 flex-1">
                  <span className="text-sm font-medium truncate" title={payload}>{payload}</span>
                </div>
              </div>

              {/* 视觉引导线 (Leader Line) - 弱化版 */}
              <div className="flex-1 mx-3 border-b border-dashed border-default-400/30 dark:border-default-500/30 min-w-[20px] self-center mt-1"></div>
              
              {/* 路由策略 Proxy Target (推靠到右侧，整齐划一) */}
              <div className="flex flex-shrink-0 items-center gap-1 overflow-hidden">
                <Chip
                  size="sm"
                  variant="flat"
                  color={getProxyColor(proxy)}
                  classNames={{ content: 'text-xs' }}
                  className="max-w-[7rem]"
                >
                  <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                    {proxy}
                  </span>
                </Chip>
                {currentNode && currentNode !== proxy && (
                  <>
                    <span className="text-xs text-foreground-300 flex-shrink-0">→</span>
                    <Chip
                      size="sm"
                      variant="flat"
                      classNames={{ content: 'text-xs flag-emoji' }}
                      className="max-w-[8rem] border border-secondary/20 bg-secondary/10 text-secondary flex-shrink-0"
                    >
                      <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                        {currentNode}
                      </span>
                    </Chip>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

export default RuleItem
