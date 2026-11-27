import { Button, Card, CardBody, Chip } from '@heroui/react'
import { IoMdRefresh } from 'react-icons/io'
import { CgLoadbarDoc } from 'react-icons/cg'
import { LuFilePenLine } from 'react-icons/lu'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import React from 'react'
import { useGroups } from '@renderer/hooks/use-groups'
import { useI18n } from '@renderer/i18n'
import { resolveFinalProxyNode } from '@renderer/utils/proxy-groups'
import { getProxyColor } from '@renderer/utils/proxy-colors'
import { CARD_STYLES } from '@renderer/utils/card-styles'

import AppSwitch from '@renderer/components/base/app-switch'

dayjs.extend(relativeTime)

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
  const { t } = useI18n()
  const { groups = [] } = useGroups()

  const currentNode = rule?.proxy ? resolveFinalProxyNode(groups, rule.proxy) : null

  // 名称：优先使用 provider 的名称，如果没有则使用 rule 的 payload
  const name = provider?.name || rule?.payload || 'Unknown'
  // 格式/类型：Inline provider 没有 format 时沿用旧文案，其余情况回退到规则类型
  const format =
    provider?.format ||
    (provider?.vehicleType === 'Inline' ? 'InlineRule' : rule?.type || 'RuleSet')

  return (
    <div className={`w-full px-2 pb-2 ${!enabled ? 'opacity-50' : ''}`}>
      <Card
        shadow="sm"
        radius="lg"
        className={`group ${CARD_STYLES.MANAGEMENT_CARD} ${CARD_STYLES.MANAGEMENT_NEUTRAL} ${!enabled ? 'grayscale' : ''}`}
      >
        <CardBody className="w-full py-2.5 px-4">
          <div className="flex items-center gap-2">
            {/* 开关 Toggle */}
            {rule && onToggle && (
              <AppSwitch
                size="sm"
                isSelected={enabled}
                onValueChange={() => onToggle()}
                classNames={{
                  wrapper: 'h-4 w-7',
                  thumb: 'h-3 w-3'
                }}
              />
            )}

            {/* 序号 Index */}
            <span
              className={`w-6 flex-shrink-0 text-right text-xs tabular-nums text-foreground/65 ${!enabled ? 'line-through' : ''}`}
            >
              {index + 1}.
            </span>

            {/* 核心信息区：定宽类型列 + 左对齐名称 + 右对齐策略 */}
            <div
              className={`min-w-0 flex-1 flex items-center gap-3 ${!enabled ? 'opacity-60 grayscale' : ''}`}
            >
              {/* 类型列 */}
              <div className="w-[84px] flex-shrink-0">
                <span className="inline-flex max-w-full items-center truncate rounded-full border border-default-200/80 bg-default-100/70 px-2.5 py-0.5 text-[11px] font-medium tracking-tight text-foreground/80 dark:border-white/10 dark:bg-white/[0.06]">
                  {format === 'PROCESS-NAME-WILDCARD'
                    ? 'PROC-NAME-WILD'
                    : format === 'PROCESS-PATH-WILDCARD'
                      ? 'PROC-PATH-WILD'
                      : format === 'File'
                        ? 'InlineRule'
                        : format}
                </span>
              </div>

              {/* 名称 + 数量 */}
              <div className="flex items-baseline gap-1.5 min-w-0 flex-1">
                <span className="text-sm font-medium truncate" title={name}>
                  {name}
                </span>
                {provider && (
                  <span className="text-xs text-foreground/65 font-normal flex-shrink-0 tabular-nums">
                    {provider.ruleCount}
                  </span>
                )}
              </div>

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
                      <span className="text-xs text-foreground/50 flex-shrink-0">→</span>
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
            <div className="flex items-center flex-shrink-0 ml-2">
              {provider && (
                <div className="flex items-center gap-2 pr-1">
                  {/* 更新时间，定宽居中对齐，平衡两侧间距 */}
                  <span className="text-foreground/65 text-xs w-[48px] text-center hidden sm:inline-block tracking-tighter whitespace-nowrap overflow-hidden text-ellipsis">
                    {dayjs(provider.updatedAt).fromNow()}
                  </span>

                  {/* 按钮区 */}
                  <div
                    className={`flex items-center gap-1 transition-opacity ${
                      updating
                        ? 'opacity-100'
                        : 'opacity-55 group-hover:opacity-100 focus-within:opacity-100'
                    }`}
                  >
                    {provider.vehicleType !== 'Inline' && (
                      <Button
                        isIconOnly
                        variant="light"
                        title={
                          provider.vehicleType === 'File' ? t('common.edit') : t('common.view')
                        }
                        size="sm"
                        onPress={onView}
                        className="min-w-8 w-8 h-8 text-foreground/65 hover:text-foreground"
                      >
                        {provider.vehicleType === 'File' ? (
                          <LuFilePenLine className="text-base" />
                        ) : (
                          <CgLoadbarDoc className="text-base" />
                        )}
                      </Button>
                    )}
                    <Button
                      isIconOnly
                      variant="light"
                      title={t('common.update')}
                      size="sm"
                      onPress={onUpdate}
                      className="min-w-8 w-8 h-8 text-foreground/65 hover:text-primary"
                    >
                      <IoMdRefresh className={`text-base ${updating ? 'animate-spin text-primary' : ''}`} />
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
