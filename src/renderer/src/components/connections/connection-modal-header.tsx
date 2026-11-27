import React from 'react'
import { Tooltip, Chip, Button } from '@heroui/react'
import { FaGlobeAmericas } from 'react-icons/fa'
import { IoUnlink } from 'react-icons/io5'
import MihomoIcon from '@renderer/components/base/mihomo-icon'
import { useI18n } from '@renderer/i18n'

interface Props {
  connection: ControllerConnectionDetail
  processIconUrl: string
  useMihomoIcon: boolean
  duration: string
  onDisconnect?: (id: string) => void
}

export const ConnectionModalHeader: React.FC<Props> = ({
  connection,
  processIconUrl,
  useMihomoIcon,
  duration,
  onDisconnect
}) => {
  const { t } = useI18n()
  const processName = connection.metadata.process || 'Unknown Process'
  const processPath = connection.metadata.processPath

  return (
    <div className="flex justify-between items-center px-2 py-2 z-10">
      <div className="flex items-center gap-3 min-w-0 flex-1 pr-10">
        {/* 进程图标 */}
        <div className="w-13 h-13 rounded-[12px] bg-white dark:bg-zinc-900/75 border border-default-300/85 dark:border-white/15 shadow-[0_1px_3px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[0_2px_6px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.08)] flex items-center justify-center shrink-0">
          {useMihomoIcon ? (
            <MihomoIcon className="w-8 h-8 text-foreground/80" />
          ) : processIconUrl ? (
            <img src={processIconUrl} className="w-8 h-8 object-contain" alt="" />
          ) : (
            <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
              <FaGlobeAmericas className="text-lg text-primary" />
            </div>
          )}
        </div>

        {/* 标题信息 */}
        <div className="flex flex-col min-w-0 flex-1 gap-1.5">
          <Tooltip
            content={processPath || 'Unknown Path'}
            placement="bottom-start"
            showArrow={true}
            classNames={{
              base: 'before:bg-default-200 after:bg-default-200',
              content:
                'bg-content1 text-foreground/80 font-mono text-xs px-2 py-1 shadow-sm border border-default-200'
            }}
          >
            <h2 className="text-xl font-bold text-foreground tracking-tight cursor-help w-fit leading-tight">
              {processName}
            </h2>
          </Tooltip>
          <div className="flex items-center gap-2 flex-wrap">
            <Chip
              size="sm"
              variant="flat"
              color="primary"
              className="h-5.5 px-1.5 bg-primary/10 text-primary text-[11px] font-medium"
            >
              {connection.metadata.network.toUpperCase()} · {connection.metadata.type}
            </Chip>
            <span className="inline-flex items-center h-5.5 px-2 rounded-full bg-default-200/65 dark:bg-white/[0.08] text-foreground/85 font-mono text-[11px] font-medium tabular-nums">
              {duration}
            </span>
            {onDisconnect && (
              <Button
                size="sm"
                variant="flat"
                color="danger"
                className="h-5.5 min-w-0 rounded-full px-2.5 text-[11px] font-medium"
                startContent={<IoUnlink className="text-xs" />}
                onPress={() => onDisconnect(connection.id)}
              >
                {t('connections.detail.disconnect')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
