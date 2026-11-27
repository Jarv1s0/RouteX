import React, { useMemo } from 'react'
import { ScrollShadow } from '@heroui/react'
import { MdTimeline } from 'react-icons/md'
import { IoArrowForward } from 'react-icons/io5'
import { clsx } from 'clsx'
import dayjs from 'dayjs'
import { useI18n } from '@renderer/i18n'
import { getDelayColorClass } from '@renderer/utils/delay-color'

interface TimelineNodeProps {
  type: 'source' | 'proxy' | 'destination'
  title: string
  subtitle?: string
  time?: string
  delay?: number
  delayColorClass?: string
  isLast?: boolean
  isGroup?: boolean
  groupType?: string
  icon?: string
  tagLabel?: string
  tagClassName?: string
}

const TimelineNode: React.FC<TimelineNodeProps> = ({
  type,
  title,
  subtitle,
  time,
  delay,
  delayColorClass,
  isLast,
  isGroup,
  groupType,
  icon,
  tagLabel,
  tagClassName
}) => {
  const { t } = useI18n()

  return (
    <div className="relative pl-8 pb-4 last:pb-0 group">
      {/* 连接线 */}
      {!isLast && (
        <div className="absolute left-[13px] top-6 bottom-0 w-px bg-default-200/80 dark:bg-white/10 group-hover:bg-primary/30 transition-colors" />
      )}

      {/* 节点图标/圆点 */}
      <div
        className={clsx(
          'absolute z-10 rounded-full border-[2.5px] flex items-center justify-center transition-all bg-background',
          type === 'source'
            ? 'left-[5px] top-1 w-4.5 h-4.5 border-emerald-500/60 shadow-[0_0_0_2px_rgba(16,185,129,0.1)]'
            : type === 'destination'
              ? 'left-[5px] top-1 w-4.5 h-4.5 border-secondary shadow-[0_0_0_2px_rgba(151,80,221,0.15)]'
              : 'left-[7px] top-1.5 w-3.5 h-3.5 border-default-300 dark:border-white/25 group-hover:border-primary'
        )}
      >
        {/* 中心点，仅 Source/Dest 显示 */}
        {(type === 'source' || type === 'destination') && (
          <div
            className={clsx(
              'w-1.5 h-1.5 rounded-full',
              type === 'source' ? 'bg-emerald-500' : 'bg-secondary'
            )}
          />
        )}
      </div>

      {/* 内容主体 */}
      <div
        className={clsx(
          'relative rounded-[12px] border transition-all',
          isGroup
            ? 'p-2.5 bg-white/95 dark:bg-zinc-900/65 border-default-200/85 dark:border-white/12 hover:border-primary/40 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
            : 'bg-transparent border-transparent py-0 pl-0 pr-2.5'
        )}
      >
        {/* 顶部标签行 */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 mb-0.5">
          <div className="flex min-w-0 items-center gap-1.5">
            {type === 'source' && (
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                {t('connections.detail.start')}
              </span>
            )}
            {type === 'destination' && (
              <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">
                {t('connections.detail.end')}
              </span>
            )}
            {tagLabel && !isGroup && type !== 'source' && type !== 'destination' && (
              <span
                className={clsx(
                  'text-[10px] font-semibold px-1.5 py-0.5 rounded',
                  tagClassName || 'text-foreground/80 bg-default-100'
                )}
              >
                {tagLabel}
              </span>
            )}
            {isGroup && (
              <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                {groupType || t('connections.detail.policyGroup')}
              </span>
            )}
            {!isGroup && !tagLabel && type === 'proxy' && (
              <span className="text-[10px] font-semibold text-foreground/80 bg-default-200/70 dark:bg-white/[0.08] px-1.5 py-0.5 rounded">
                {t('connections.detail.node')}
              </span>
            )}
          </div>

          {/* 延迟显示 */}
          {delay !== undefined && (
            <div className="flex w-[64px] shrink-0 items-center justify-start gap-1 font-mono tabular-nums">
              <div
                className={clsx(
                  'w-1.5 h-1.5 shrink-0 rounded-full',
                  delayColorClass?.replace('text-', 'bg-')
                )}
              />
              <span
                className={clsx(
                  'text-left text-[11px] font-mono font-semibold tabular-nums whitespace-nowrap',
                  delayColorClass
                )}
              >
                {delay === 0 ? 'Timeout' : `${delay}ms`}
              </span>
            </div>
          )}
          {time && (
            <span className="w-[64px] shrink-0 justify-self-end text-left text-[11px] font-mono tabular-nums text-foreground/65 whitespace-nowrap">
              {time}
            </span>
          )}
        </div>

        {/* 标题 */}
        <div className="flex items-center gap-2 min-w-0">
          {icon && <img src={icon} className="w-3.5 h-3.5 object-contain opacity-80" alt="" />}
          <span
            className={clsx(
              'text-[13px] font-medium truncate',
              isGroup ? 'text-foreground font-semibold' : 'text-foreground/90'
            )}
            title={title}
          >
            {title}
          </span>
        </div>

        {/* 次级信息（命中值 / 当前节点 / 端口） */}
        {subtitle && (
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-foreground/75 min-w-0">
            <IoArrowForward className="text-[10px] shrink-0 text-primary/70" />
            <span className="font-mono truncate text-primary/90 font-medium" title={subtitle}>
              {subtitle}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

interface Props {
  connection: ControllerConnectionDetail
  groups: ControllerMixedGroup[]
  delayThresholds?: { good: number; fair: number }
}

export const ConnectionChainPath: React.FC<Props> = ({
  connection,
  groups,
  delayThresholds = { good: 200, fair: 500 }
}) => {
  const { t } = useI18n()
  const destination = connection.metadata.host
    ? `${connection.metadata.host}:${connection.metadata.destinationPort}`
    : `${connection.metadata.destinationIP}:${connection.metadata.destinationPort}`
  const processPath = connection.metadata.processPath

  // 查找代理链中的组信息
  const chainGroups = useMemo(() => {
    return connection.chains
      .map((chainName, index) => {
        const group = groups.find((g) => g.name === chainName)

        // 如果不是组，尝试在所有组的一级子节点中查找该代理以获取详情（如延迟）
        let leafProxy: ControllerProxiesDetail | undefined
        if (!group) {
          for (const g of groups) {
            const found = g.all?.find((p) => p.name === chainName)
            if (found) {
              leafProxy = found
              break
            }
          }
        }

        return { name: chainName, group, leafProxy, isLast: index === connection.chains.length - 1 }
      })
      .reverse()
  }, [connection.chains, groups])

  return (
    <div className="w-[320px] border-l border-default-200/75 dark:border-white/10 bg-white/55 dark:bg-black/20 p-2.5 flex flex-col min-h-0 relative overflow-hidden">
      <div className="flex items-center gap-2 mb-2.5 px-1 pt-0.5 relative z-10">
        <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
          <MdTimeline className="text-base" />
        </div>
        <span className="text-sm font-semibold text-foreground tracking-wide">
          {t('connections.detail.chain')}
        </span>
      </div>

      <ScrollShadow className="flex-1 -mr-2 pr-2 relative z-10 pb-2">
        <div className="flex flex-col gap-0">
          {/* 源节点 */}
          <TimelineNode
            type="source"
            title={processPath ? processPath.split(/[\\/]/).pop() || 'Unknown' : 'Unknown'}
            time={dayjs(connection.start).format('HH:mm:ss')}
          />

          {/* 规则节点 */}
          {(connection.rule || connection.rulePayload) && (
            <TimelineNode
              type="proxy"
              title={connection.rule || t('connections.detail.rule')}
              subtitle={
                connection.rulePayload
                  ? t('connections.detail.matchedValue', { value: connection.rulePayload })
                  : undefined
              }
              tagLabel={t('connections.detail.rule')}
              tagClassName="text-secondary bg-secondary/10"
            />
          )}

          {/* 代理链节点 */}
          {chainGroups.map((item, index) => {
            const { name, group, leafProxy } = item

            // 如果当前节点的名字与上一个节点组的选择(now)相同，则隐藏（避免重复）
            // 仅当当前项不是组时隐藏（显示组更有意义）
            const prevItem = chainGroups[index - 1]
            if (!group && prevItem && prevItem.group && prevItem.group.now === name) {
              return null
            }

            let delay: number | undefined
            if (group) {
              delay = group.all?.find((p) => p.name === group.now)?.history?.at(-1)?.delay
            } else if (leafProxy) {
              delay = leafProxy.history?.at(-1)?.delay
            }

            return (
              <TimelineNode
                key={index}
                type={'proxy'}
                title={name}
                subtitle={
                  group?.now ? t('connections.detail.current', { value: group.now }) : undefined
                }
                delay={delay}
                delayColorClass={
                  delay === undefined ? undefined : getDelayColorClass(delay, delayThresholds)
                }
                isGroup={!!group}
                icon={group?.icon}
                groupType={group?.type}
              />
            )
          })}

          {/* 目标节点 */}
          <TimelineNode
            type="destination"
            title={connection.metadata.host || connection.metadata.destinationIP || destination}
            subtitle={
              connection.metadata.destinationPort
                ? t('connections.detail.port', { value: connection.metadata.destinationPort })
                : undefined
            }
            isLast
          />
        </div>
      </ScrollShadow>
    </div>
  )
}
