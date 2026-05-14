import React, { useEffect, useState, useCallback } from 'react'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Spinner,
  Card,
  CardBody,
  Chip,
  Divider
} from '@heroui/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { serviceStatus, testServiceConnection } from '@renderer/utils/service-ipc'
import SecondaryModalCloseButton from '@renderer/components/base/secondary-modal-close'
import {
  createSecondaryModalClassNames,
  getMainPaneModalContentStyle,
  SECONDARY_MODAL_HEADER_CLASSNAME
} from '@renderer/utils/modal-styles'
import { useI18n } from '@renderer/i18n'

interface Props {
  onChange: (open: boolean) => void
  onInit: () => Promise<void>
  onInstall: () => Promise<void>
  onUninstall: () => Promise<void>
  onStart: () => Promise<void>
  onRestart: () => Promise<void>
  onStop: () => Promise<void>
}

type ServiceStatusType = 'running' | 'stopped' | 'not-installed' | 'unknown' | 'need-init'
type ConnectionStatusType = 'connected' | 'disconnected' | 'checking' | 'unknown'

const ServiceModal: React.FC<Props> = (props) => {
  const { t } = useI18n()
  const { onChange, onInit, onInstall, onUninstall, onStart, onStop, onRestart } = props
  const {
    appConfig: { disableAnimation = false, collapseSidebar = false, siderWidth = 250 } = {}
  } = useAppConfig()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<ServiceStatusType | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusType>('checking')

  const checkServiceConnection = useCallback(async (): Promise<void> => {
    if (status === 'running') {
      try {
        setConnectionStatus('checking')
        const connected = await testServiceConnection()
        setConnectionStatus(connected ? 'connected' : 'disconnected')
      } catch {
        setConnectionStatus('disconnected')
      }
    } else {
      setConnectionStatus('disconnected')
    }
  }, [status])

  useEffect(() => {
    const checkStatus = async (): Promise<void> => {
      try {
        const result = await serviceStatus()
        setStatus(result)
      } catch {
        setStatus('not-installed')
      }
    }
    checkStatus()
  }, [])

  useEffect(() => {
    checkServiceConnection()
  }, [status, checkServiceConnection])

  const handleAction = async (
    action: () => Promise<void>,
    isStartAction = false
  ): Promise<void> => {
    setLoading(true)
    try {
      await action()

      await new Promise((resolve) => setTimeout(resolve, 500))

      let result = await serviceStatus()

      if (isStartAction) {
        let retries = 5
        while (retries > 0 && result === 'stopped') {
          await new Promise((resolve) => setTimeout(resolve, 1000))
          result = await serviceStatus()
          retries--
        }
      }

      setStatus(result)
      await checkServiceConnection()
    } catch (e) {
      const errorMsg = String(e)
      if (errorMsg.includes('用户取消操作') || errorMsg.includes('UserCancelledError')) {
        const result = await serviceStatus()
        setStatus(result)
        await checkServiceConnection()
        return
      }
      alert(e)
    } finally {
      setLoading(false)
    }
  }

  const getStatusText = (): string => {
    if (status === null) return t('mihomo.permission.checking')
    switch (status) {
      case 'running':
        return t('mihomo.service.running')
      case 'stopped':
        return t('mihomo.service.stopped')
      case 'not-installed':
        return t('mihomo.service.notInstalled')
      case 'need-init':
        return t('mihomo.service.needInit')
      default:
        return t('mihomo.service.unknownStatus')
    }
  }

  const getConnectionStatusText = (): string => {
    switch (connectionStatus) {
      case 'connected':
        return t('mihomo.service.connected')
      case 'disconnected':
        return t('mihomo.service.disconnected')
      case 'checking':
        return t('mihomo.service.checking')
      default:
        return t('common.unknown')
    }
  }

  return (
    <Modal
      backdrop={disableAnimation ? 'transparent' : 'blur'}
      disableAnimation={disableAnimation}
      hideCloseButton
      isOpen={true}
      size="5xl"
      onOpenChange={onChange}
      scrollBehavior="inside"
      classNames={createSecondaryModalClassNames({
        base: 'max-w-none w-full'
      })}
    >
      <ModalContent
        className="w-[450px]"
        style={getMainPaneModalContentStyle({ collapseSidebar, siderWidth, maxWidthPx: 450 })}
      >
        <ModalHeader className={SECONDARY_MODAL_HEADER_CLASSNAME}>
          <span>{t('mihomo.service.title')}</span>
          <SecondaryModalCloseButton onPress={() => onChange(false)} />
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <Card
              shadow="sm"
              className="border-none bg-gradient-to-br from-default-50 to-default-100"
            >
              <CardBody className="py-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{t('mihomo.service.serviceStatus')}</span>
                  </div>
                  {status === null ? (
                    <Chip
                      color="default"
                      variant="flat"
                      size="sm"
                      startContent={<Spinner size="sm" color="current" />}
                    >
                      {t('mihomo.permission.checkingDots')}
                    </Chip>
                  ) : (
                    <Chip
                      color={
                        status === 'running'
                          ? 'success'
                          : status === 'stopped'
                            ? 'warning'
                            : status === 'not-installed'
                              ? 'danger'
                              : status === 'need-init'
                                ? 'warning'
                                : 'default'
                      }
                      variant="flat"
                      size="sm"
                    >
                      {getStatusText()}
                    </Chip>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {t('mihomo.service.connectionStatus')}
                    </span>
                  </div>
                  {connectionStatus === 'checking' ? (
                    <Chip
                      color="default"
                      variant="flat"
                      size="sm"
                      startContent={<Spinner size="sm" color="current" />}
                    >
                      {t('mihomo.service.checkingDots')}
                    </Chip>
                  ) : (
                    <Chip
                      color={
                        connectionStatus === 'connected'
                          ? 'success'
                          : connectionStatus === 'disconnected'
                            ? 'danger'
                            : 'default'
                      }
                      variant="flat"
                      size="sm"
                    >
                      {getConnectionStatusText()}
                    </Chip>
                  )}
                </div>
              </CardBody>
            </Card>

            <Divider />

            <div className="text-xs text-default-500 space-y-2">
              <div className="flex items-start gap-2">
                <span>{t('mihomo.service.hint1')}</span>
              </div>
              <div className="flex items-start gap-2">
                <span>{t('mihomo.service.hint2')}</span>
              </div>
              <div className="flex items-start gap-2">
                <span>{t('mihomo.service.hint3')}</span>
              </div>
              <div className="flex items-start gap-2">
                <span>{t('mihomo.service.hint4')}</span>
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter className="space-x-2">
          <Button size="sm" variant="light" onPress={() => onChange(false)} isDisabled={loading}>
            {t('common.close')}
          </Button>

          {status === 'unknown' ? null : status === 'not-installed' ? (
            <Button
              size="sm"
              color="primary"
              variant="shadow"
              onPress={() => handleAction(onInstall)}
              isLoading={loading}
            >
              {t('mihomo.service.install')}
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                color="primary"
                variant="flat"
                onPress={() => handleAction(onInit)}
                isLoading={loading}
              >
                {t('mihomo.service.init')}
              </Button>
              <Button
                size="sm"
                color="primary"
                variant="flat"
                onPress={() => handleAction(onRestart)}
                isLoading={loading}
              >
                {t('mihomo.service.restart')}
              </Button>
              {status === 'running' || status === 'need-init' ? (
                <Button
                  size="sm"
                  color="warning"
                  variant="flat"
                  onPress={() => handleAction(onStop)}
                  isLoading={loading}
                >
                  {t('mihomo.service.stop')}
                </Button>
              ) : (
                <Button
                  size="sm"
                  color="success"
                  variant="shadow"
                  onPress={() => handleAction(onStart, true)}
                  isLoading={loading}
                >
                  {t('mihomo.service.start')}
                </Button>
              )}
              <Button
                size="sm"
                color="danger"
                variant="flat"
                onPress={() => handleAction(onUninstall)}
                isLoading={loading}
              >
                {t('mihomo.service.uninstall')}
              </Button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default ServiceModal
