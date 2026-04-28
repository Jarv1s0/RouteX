import { Button, Card, CardBody, Chip, Switch } from '@heroui/react'
import { IoMdRefresh } from 'react-icons/io'
import { CgLoadbarDoc } from 'react-icons/cg'
import { MdOutlineEdit } from 'react-icons/md'
import dayjs from 'dayjs'
import React from 'react'
import { useGroups } from '@renderer/hooks/use-groups'

interface RemoteRuleItemProps {
  rule?: ControllerRulesDetail
  provider?: ControllerRuleProviderDetail
  index: number
  enabled?: boolean
  updating?: boolean
  onToggle?: () => void
  onUpdate?: () => void
  onView?: () => void
}

const RemoteRuleItem: React.FC<RemoteRuleItemProps> = ({
  rule,
  provider,
  index,
  enabled = true,
  updating = false,
  onToggle,
  onUpdate,
  onView
}) => {
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

  const currentNode = rule?.proxy ? getFinalNode(rule.proxy) : null

  const getProxyColor = (proxy: string): 'danger' | 'success' | 'secondary' | 'primary' | 'warning' | 'default' => {
    if (proxy === 'REJECT') return 'danger'
    if (proxy === 'DIRECT') return 'default'
    return 'secondary'
  }

  // 名称：优先使用 provider 的名称，如果没有则使用 rule 的 payload
  const name = provider?.name || rule?.payload || 'Unknown'
  // 格式/类型：Inline provider 没有 format 时沿用旧文案，其余情况回退到规则类型
  const format = provider?.format || (provider?.vehicleType === 'Inline' ? 'InlineRule' : rule?.type || 'RuleSet')

  return (
    <div className={`w-full px-2 pb-2 ${!enabled ? 'opacity-50' : ''}`}>
      <Card
        shadow="sm"
        radius="lg"
        className={`bg-default-100/60 dark:bg-default-50/30 backdrop-blur-md border border-default-200/60 dark:border-white/10 hover:bg-default-200/60 dark:hover:bg-default-100/40 hover:-translate-y-0.5 hover:shadow-md transition-all ${!enabled ? 'grayscale' : ''}`}
      >
        <CardBody className="w-full py-2 px-3">
          <div className="flex items-center gap-2">
            {/* 开关 Toggle */}
            {rule && onToggle && (
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
            
            {/* 序号 Index */}
            <span className={`w-6 flex-shrink-0 -mr-1 text-xs text-foreground-400 ${!enabled ? 'line-through' : ''}`}>
              {index + 1}.
            </span>
            
            {/* 核心信息区：使用引导线(Leader Line)连接名称和策略，解决空洞感 */}
            <div className={`min-w-0 flex-1 flex items-center ${!enabled ? 'opacity-60 grayscale' : ''}`}>
              
              {/* 类型 + 名称 + 数量 */}
              <div className="flex items-center gap-2 flex-shrink-0 min-w-0 max-w-[65%]">
                <Chip size="sm" variant="flat" color="default" classNames={{ content: 'text-xs' }} className="flex-shrink-0">
                  {format === 'PROCESS-NAME-WILDCARD'
                    ? 'PROC-NAME-WILD'
                    : format === 'PROCESS-PATH-WILDCARD'
                      ? 'PROC-PATH-WILD'
                      : format === 'File' ? 'InlineRule' : format}
                </Chip>
                <div className="flex items-baseline gap-1.5 min-w-0 flex-1">
                  <span className="text-sm font-medium truncate" title={name}>{name}</span>
                  {provider && (
                    <span className="text-xs text-foreground-400 font-normal flex-shrink-0">
                      {provider.ruleCount}
                    </span>
                  )}
                </div>
              </div>

              {/* 视觉引导线 (Leader Line) - 弱化版 */}
              {rule && (
                <div className="flex-1 mx-3 border-b border-dashed border-default-400/30 dark:border-default-500/30 min-w-[20px] self-center mt-1"></div>
              )}

              {/* 路由策略 Proxy Target (推靠到右侧，整齐划一) */}
              {rule && (
                <div className="flex flex-shrink-0 items-center gap-1 overflow-hidden">
                  <Chip
                    size="sm"
                    variant="flat"
                    color={getProxyColor(rule.proxy)}
                    classNames={{ content: 'text-xs' }}
                    className="max-w-[7rem]"
                  >
                    <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                      {rule.proxy}
                    </span>
                  </Chip>
                  {currentNode && currentNode !== rule.proxy && (
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
              )}
            </div>

            {/* 右侧信息及操作区 Right side info & Actions (只保留时间和按钮) */}
            <div className="flex items-center flex-shrink-0 ml-3">
              {provider && (
                <div className="flex items-center gap-2 pr-1">
                  {/* 更新时间，定宽居中对齐，平衡两侧间距 */}
                  <span className="text-foreground-400 text-xs w-[48px] text-center hidden sm:inline-block tracking-tighter whitespace-nowrap overflow-hidden text-ellipsis">
                    {dayjs(provider.updatedAt).fromNow(true)}
                  </span>
                  
                  {/* 按钮区定宽 */}
                  <div className="flex items-center justify-end w-[64px]">
                    {provider.vehicleType !== 'Inline' && (
                      <Button
                        isIconOnly
                        variant="light"
                        title={provider.vehicleType === 'File' ? '编辑' : '查看'}
                        size="sm"
                        onPress={onView}
                        className="min-w-8 w-8 h-8"
                      >
                        {provider.vehicleType === 'File' ? (
                          <MdOutlineEdit className="text-lg" />
                        ) : (
                          <CgLoadbarDoc className="text-lg" />
                        )}
                      </Button>
                    )}
                    <Button
                      isIconOnly
                      variant="light"
                      title="更新"
                      size="sm"
                      onPress={onUpdate}
                      className="min-w-8 w-8 h-8"
                    >
                      <IoMdRefresh className={`text-lg ${updating ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

export default RemoteRuleItem
