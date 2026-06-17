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
    <div className="flex justify-between items-start px-2 pt-2 pb-2 z-10">
      <div className="flex items-start gap-6 min-w-0 flex-1 pr-14">
        {/* 进程图标 */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-default-100 to-default-50 border border-white/20 shadow-lg flex items-center justify-center shrink-0">
          {useMihomoIcon ? (
            <MihomoIcon className="w-10 h-10 text-foreground-600 dark:text-foreground-300 drop-shadow-md" />
          ) : processIconUrl ? (
            <img src={processIconUrl} className="w-10 h-10 object-contain drop-shadow-md" alt="" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <FaGlobeAmericas className="text-2xl text-primary" />
            </div>
          )}
        </div>

        {/* 标题信息 */}
        <div className="flex flex-col pt-1 min-w-0 flex-1">
          <Tooltip
            content={processPath || 'Unknown Path'}
            placement="bottom"
            showArrow={true}
            classNames={{
              base: 'before:bg-default-200 after:bg-default-200',
              content:
                'bg-content1 text-default-500 font-mono text-xs px-2 py-1 shadow-sm border border-default-200'
            }}
          >
            <h2 className="text-2xl font-bold text-foreground tracking-tight mb-2 cursor-help decoration-dashed decoration-default-300 underline-offset-4 w-fit">
              {processName}
            </h2>
          </Tooltip>
          <div className="flex items-center gap-2 flex-wrap">
            <Chip
              size="sm"
              variant="flat"
              color="primary"
              className="h-6 px-1 bg-primary/10 text-primary font-medium border border-primary/20"
            >
              {connection.metadata.network.toUpperCase()}
            </Chip>
            <Chip
              size="sm"
              variant="flat"
              className="h-6 px-1 bg-default-100 text-default-600 font-medium border border-default-200"
            >
              {connection.metadata.type}
            </Chip>
            <Chip
              size="sm"
              variant="flat"
              className="h-6 px-1 bg-content2 text-foreground font-mono font-bold border border-default-200 min-w-[60px] justify-center"
            >
              {duration}
            </Chip>
            {connection.rule && (
              <Chip
                size="sm"
                variant="flat"
                color="secondary"
                className="h-6 px-1 bg-secondary/10 text-secondary font-medium border border-secondary/20 max-w-[180px] opacity-85"
              >
                <span className="truncate">{connection.rule}</span>
              </Chip>
            )}
            {onDisconnect && (
              <Button
                size="sm"
                variant="flat"
                color="danger"
                className="h-6 min-w-0 rounded-md px-2 text-xs font-medium"
                startContent={<IoUnlink className="text-sm" />}
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
