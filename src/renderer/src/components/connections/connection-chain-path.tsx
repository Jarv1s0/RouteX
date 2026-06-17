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
  const nonGroupInsetClass = isGroup ? '' : 'px-3'

  return (
    <div className="relative pl-9 pb-4 last:pb-0 group">
      {/* 连接线 */}
      {!isLast && (
        <div className="absolute left-[15px] top-7 bottom-0 w-0.5 bg-default-200/50 group-hover:bg-primary/20 transition-colors" />
      )}

      {/* 节点图标/圆点 */}
      <div
        className={clsx(
          'absolute left-[6px] top-1 w-5 h-5 rounded-full border-[3px] z-10 flex items-center justify-center transition-all bg-content1',
          type === 'source'
            ? 'border-emerald-500/50 w-5 h-5 shadow-[0_0_0_2px_rgba(16,185,129,0.1)]'
            : type === 'destination'
              ? 'border-secondary w-5 h-5 shadow-[0_0_0_2px_rgba(151,80,221,0.2)]'
              : 'border-default-300 group-hover:border-primary group-hover:w-5 group-hover:h-5 w-4 h-4 left-[8px] top-1.5'
        )}
      >
        {/* 中心点，仅 Source/Dest 显示 */}
        {(type === 'source' || type === 'destination') && (
          <div
            className={clsx(
              'w-1.5 h-1.5 rounded-full',
              type === 'source' ? 'bg-emerald-500/75' : 'bg-secondary'
            )}
          />
        )}
      </div>

      {/* 内容主体 */}
      <div
        className={clsx(
          'relative rounded-xl border p-3 transition-all',
          isGroup
            ? 'bg-content1/80 dark:bg-default-100/80 border-default-300/60 dark:border-white/10 hover:border-primary/40 shadow-sm hover:shadow-md backdrop-blur-sm'
            : 'bg-transparent border-transparent px-0 py-0'
        )}
      >
        {/* 顶部标签行 */}
        <div
          className={clsx(
            'grid grid-cols-[minmax(0,1fr)_88px] items-center gap-2 mb-1',
            nonGroupInsetClass
          )}
        >
          <div className="flex min-w-0 items-center gap-1.5">
            {type === 'source' && (
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase bg-emerald-500/10 px-1.5 rounded">
                {t('connections.detail.start')}
              </span>
            )}
            {type === 'destination' && (
              <span className="text-[10px] font-bold text-purple-500 uppercase bg-purple-500/10 px-1.5 rounded">
                {t('connections.detail.end')}
              </span>
            )}
            {tagLabel && !isGroup && type !== 'source' && type !== 'destination' && (
              <span
                className={clsx(
                  'text-[10px] font-bold uppercase px-1.5 rounded',
                  tagClassName || 'text-default-400 bg-default-100'
                )}
              >
                {tagLabel}
              </span>
            )}
            {isGroup && (
              <span className="text-[10px] font-bold text-primary uppercase bg-primary/10 px-1.5 rounded">
                {groupType || t('connections.detail.policyGroup')}
              </span>
            )}
            {!isGroup && type === 'proxy' && (
              <span className="text-[10px] font-bold text-default-400 uppercase bg-default-100 px-1.5 rounded">
                {t('connections.detail.node')}
              </span>
            )}
          </div>

          {/* 延迟显示 */}
          {delay !== undefined && (
            <div className="flex w-[88px] items-center justify-end gap-[2px] font-mono tabular-nums">
              <div
                className={clsx(
                  'w-1.5 h-1.5 shrink-0 rounded-full',
                  delayColorClass?.replace('text-', 'bg-')
                )}
              />
              <span
                className={clsx(
                  'inline-block w-[48px] text-right text-xs font-mono font-bold tabular-nums',
                  delayColorClass
                )}
              >
                {delay === 0 ? 'Timeout' : `${delay}ms`}
              </span>
            </div>
          )}
          {time && (
            <span className="w-[88px] justify-self-end text-right text-[10px] font-mono tabular-nums text-default-400">
              {time}
            </span>
          )}
        </div>

        {/* 标题 */}
        <div className={clsx('flex items-center gap-2 min-w-0', nonGroupInsetClass)}>
          {icon && <img src={icon} className="w-3.5 h-3.5 object-contain opacity-80" alt="" />}
          <span
            className={clsx(
              'text-sm font-medium truncate pr-2',
              isGroup ? 'text-foreground' : 'text-default-700'
            )}
            title={title}
          >
            {title}
          </span>
        </div>

        {/* 只有 Group 节点显示具体的节点选择 */}
        {subtitle && (
          <div
            className={clsx(
              'mt-1.5 flex items-center gap-1.5 text-xs text-default-500 bg-content2/50 p-1.5 rounded-md border border-default-200/50',
              nonGroupInsetClass
            )}
          >
            <IoArrowForward className="text-[10px] shrink-0 text-primary" />
            <span className="font-mono truncate font-bold text-primary" title={subtitle}>
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
    <div className="w-[320px] bg-default-50/30 dark:bg-black/5 p-2 flex flex-col relative overflow-hidden backdrop-brightness-95 dark:backdrop-brightness-100 -ml-2">
      {/* 背景装饰线 */}
      <div className="absolute left-[23px] top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-default-300 to-transparent dashed opacity-30" />

      <div className="flex items-center gap-2 mb-2 relative z-10">
        <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
          <MdTimeline className="text-lg" />
        </div>
        <span className="font-bold text-foreground tracking-wide">
          {t('connections.detail.chain')}
        </span>
      </div>

      <ScrollShadow className="flex-1 -mr-4 pr-4 relative z-10 pb-4">
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
