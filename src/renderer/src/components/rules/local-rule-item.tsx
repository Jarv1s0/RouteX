import React, { memo } from 'react'
import { Button, Card, CardBody, Chip, Tooltip } from '@heroui/react'
import { LuFilePenLine, LuTrash2 } from 'react-icons/lu'
import { useI18n } from '@renderer/i18n'
import AppSwitch from '@renderer/components/base/app-switch'
import { getProxyColor } from '@renderer/utils/proxy-colors'
import { CARD_STYLES } from '@renderer/utils/card-styles'

interface LocalRuleItemProps {
  rule: QuickRule
  index: number
  targetMissing: boolean
  finalNode?: string
  onToggle: (rule: QuickRule) => void
  onEdit: (rule: QuickRule) => void
  onDelete: (rule: QuickRule) => void
}

const LocalRuleItem: React.FC<LocalRuleItemProps> = memo(
  ({ rule, index, targetMissing, finalNode, onToggle, onEdit, onDelete }) => {
    const { t } = useI18n()

    return (
      <div className="w-full pb-2">
        <Card
          shadow="sm"
          radius="lg"
          className={`${CARD_STYLES.RULE_CARD} ${!rule.enabled ? 'grayscale' : ''}`}
        >
          <CardBody className="w-full py-2.5 px-4">
            <div className="flex items-center gap-2">
              {/* 开关 和 序号 */}
              <AppSwitch
                size="sm"
                isSelected={rule.enabled}
                onValueChange={() => onToggle(rule)}
                classNames={{
                  wrapper: 'h-4 w-8',
                  thumb: 'h-3 w-3'
                }}
              />
              <span
                className={`w-6 flex-shrink-0 -mr-1 text-xs text-foreground-400 ${!rule.enabled ? 'line-through' : ''}`}
              >
                {index + 1}.
              </span>

              <div
                className={`flex min-w-0 flex-1 items-center ${!rule.enabled ? 'opacity-60 grayscale' : ''}`}
              >
                {/* 类型 + 名称 + no-resolve */}
                <div className="flex flex-shrink-0 items-center gap-2 min-w-0 max-w-[65%]">
                  <Chip
                    size="sm"
                    variant="flat"
                    color="default"
                    classNames={{ content: 'text-xs' }}
                    className="flex-shrink-0"
                  >
                    {rule.type}
                  </Chip>
                  <div className="ml-1 flex min-w-0 flex-1 items-center gap-1.5">
                    <span className="truncate text-sm font-medium" title={rule.value}>
                      {rule.value}
                    </span>
                    {rule.noResolve && (
                      <Chip
                        size="sm"
                        variant="flat"
                        color="warning"
                        classNames={{ content: 'text-[10px] px-1' }}
                        className="h-5 flex-shrink-0"
                      >
                        no-resolve
                      </Chip>
                    )}
                  </div>
                </div>

                {/* 视觉引导线 (Leader Line) */}
                <div className="mx-3 mt-1 min-w-[20px] flex-1 self-center border-b border-dashed border-default-400/30 dark:border-default-500/30"></div>

                {/* 路由策略 Proxy Target */}
                <div className="flex flex-shrink-0 items-center gap-1 overflow-hidden">
                  <Tooltip
                    isDisabled={!targetMissing}
                    content={t('rules.missingTargetTooltip', {
                      target: rule.target
                    })}
                    delay={300}
                    color="warning"
                  >
                    <Chip
                      size="sm"
                      variant={targetMissing ? 'bordered' : 'flat'}
                      color={targetMissing ? 'warning' : getProxyColor(rule.target)}
                      classNames={{ content: 'text-xs' }}
                      className="max-w-[7rem]"
                    >
                      <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                        {rule.target}
                      </span>
                    </Chip>
                  </Tooltip>
                  {targetMissing && (
                    <Chip
                      size="sm"
                      variant="flat"
                      color="warning"
                      classNames={{ content: 'text-[10px] px-1' }}
                      className="h-5 flex-shrink-0"
                    >
                      {t('rules.missingTargetBadge')}
                    </Chip>
                  )}
                  {finalNode && finalNode !== rule.target && (
                    <>
                      <span className="text-xs text-foreground-300 flex-shrink-0">
                        →
                      </span>
                      <Chip
                        size="sm"
                        variant="flat"
                        classNames={{ content: 'text-xs flag-emoji' }}
                        className="max-w-[8rem] border border-secondary/20 bg-secondary/10 text-secondary flex-shrink-0"
                      >
                        <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                          {finalNode}
                        </span>
                      </Chip>
                    </>
                  )}
                </div>
              </div>

              {/* 操作按钮组 */}
              <div className="ml-2 flex items-center flex-shrink-0 gap-2 pr-1">
                <Tooltip content={t('common.edit')} delay={500}>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    title={t('page.rules.edit')}
                    aria-label={t('page.rules.edit')}
                    className="min-w-8 w-8 h-8 text-default-500"
                    onPress={() => onEdit(rule)}
                  >
                    <LuFilePenLine className="text-base" />
                  </Button>
                </Tooltip>

                <Tooltip content={t('page.rules.delete')} delay={500} color="danger">
                  <Button
                    isIconOnly
                    size="sm"
                    color="danger"
                    variant="light"
                    title={t('page.rules.delete')}
                    aria-label={t('page.rules.delete')}
                    className="min-w-8 w-8 h-8"
                    onPress={() => onDelete(rule)}
                  >
                    <LuTrash2 className="text-base" />
                  </Button>
                </Tooltip>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }
)

LocalRuleItem.displayName = 'LocalRuleItem'

export default LocalRuleItem
