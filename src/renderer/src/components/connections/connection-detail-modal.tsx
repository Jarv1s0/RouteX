import React from 'react'
import { Modal, ModalContent, ModalBody } from '@heroui/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useGroups } from '@renderer/hooks/use-groups'
import SecondaryModalCloseButton from '@renderer/components/base/secondary-modal-close'
import {
  createSecondaryModalClassNames,
  getMainPaneModalContentStyle
} from '@renderer/utils/modal-styles'
import { useI18n } from '@renderer/i18n'
import { useProcessIcon } from '@renderer/hooks/use-process-icon'
import { useConnectionDuration } from '@renderer/hooks/use-connection-duration'
import { ConnectionModalHeader } from './connection-modal-header'
import { ConnectionMetadata } from './connection-metadata'
import { ConnectionChainPath } from './connection-chain-path'

interface Props {
  connection: ControllerConnectionDetail
  onClose: () => void
  onDisconnect?: (id: string) => void
}

const ConnectionDetailModal: React.FC<Props> = (props) => {
  const { connection, onClose, onDisconnect } = props
  const { t } = useI18n()
  const {
    appConfig: {
      delayThresholds = { good: 200, fair: 500 },
      collapseSidebar = false,
      siderWidth = 250
    } = {}
  } = useAppConfig()
  const { groups = [] } = useGroups()

  // 格式化 IP 和 端口
  const source = `${connection.metadata.sourceIP}:${connection.metadata.sourcePort}`
  const destination = connection.metadata.host
    ? `${connection.metadata.host}:${connection.metadata.destinationPort}`
    : `${connection.metadata.destinationIP}:${connection.metadata.destinationPort}`

  const processPath = connection.metadata.processPath
  const sniffSummary = connection.metadata.sniffHost
    ? t('connections.detail.sniffed')
    : connection.metadata.host
      ? t('connections.detail.domain')
      : 'IP'

  const { processIconUrl, useMihomoIcon } = useProcessIcon(connection.metadata.process, processPath)
  const duration = useConnectionDuration(connection.start, connection.completedAt)

  return (
    <Modal
      backdrop="blur"
      classNames={createSecondaryModalClassNames({
        backdrop: 'bg-black/40 backdrop-blur-sm',
        wrapper: 'z-[9999]',
        base: 'bg-background/60 dark:bg-default-100/50 max-h-[90vh]'
      })}
      size="5xl"
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      motionProps={{
        variants: {
          enter: {
            scale: 1,
            opacity: 1,
            filter: 'blur(0px)',
            transition: { duration: 0.25, ease: [0.32, 0.72, 0, 1] }
          },
          exit: {
            scale: 0.96,
            opacity: 0,
            filter: 'blur(4px)',
            transition: { duration: 0.2, ease: 'easeIn' }
          }
        }
      }}
    >
      <ModalContent
        className="overflow-hidden"
        style={getMainPaneModalContentStyle({ collapseSidebar, siderWidth, maxWidthPx: 1400 })}
      >
        <div className="flex flex-col gap-0 p-0 relative overflow-hidden bg-gradient-to-b from-default-100/50 to-transparent">
          {/* 顶部背景装饰 */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />

          {/* Close Button - Absolute Positioned */}
          <SecondaryModalCloseButton onPress={onClose} className="absolute right-4 top-4 z-50" />

          {/* 提取的 Header */}
          <ConnectionModalHeader
            connection={connection}
            processIconUrl={processIconUrl}
            useMihomoIcon={useMihomoIcon}
            duration={duration}
            onDisconnect={onDisconnect}
          />
        </div>

        <ModalBody className="p-0 flex flex-row h-[520px] bg-content1/30 gap-2">
          {/* 左侧：详细信息 */}
          <ConnectionMetadata
            connection={connection}
            sniffSummary={sniffSummary}
            source={source}
            destination={destination}
          />

          {/* 右侧：可视化代理链 */}
          <ConnectionChainPath
            connection={connection}
            groups={groups}
            delayThresholds={delayThresholds}
          />
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default ConnectionDetailModal
