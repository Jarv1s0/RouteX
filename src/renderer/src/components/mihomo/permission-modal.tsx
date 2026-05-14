import React, { useEffect, useState } from 'react'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider
} from '@heroui/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import {
  checkCorePermission,
  checkElevateTask,
  manualGrantCorePermition,
  revokeCorePermission
} from '@renderer/utils/service-ipc'
import { platform } from '@renderer/utils/init'
import SecondaryModalCloseButton from '@renderer/components/base/secondary-modal-close'
import {
  createSecondaryModalClassNames,
  getMainPaneModalContentStyle,
  SECONDARY_MODAL_HEADER_CLASSNAME
} from '@renderer/utils/modal-styles'
import { useI18n } from '@renderer/i18n'

interface Props {
  onChange: (open: boolean) => void
  onRevoke: () => Promise<void>
  onGrant: () => Promise<void>
}

const PermissionModal: React.FC<Props> = (props) => {
  const { t } = useI18n()
  const { onChange, onRevoke, onGrant } = props
  const {
    appConfig: { disableAnimation = false, collapseSidebar = false, siderWidth = 250 } = {}
  } = useAppConfig()
  const [loading, setLoading] = useState<{ mihomo?: boolean; 'mihomo-alpha'?: boolean }>({})
  const [hasPermission, setHasPermission] = useState<
    { mihomo: boolean; 'mihomo-alpha': boolean } | boolean | null
  >(null)
  const isWindows = platform === 'win32'

  const checkPermissions = async (): Promise<void> => {
    try {
      const result = isWindows ? await checkElevateTask() : await checkCorePermission()
      setHasPermission(result)
    } catch {
      setHasPermission(isWindows ? false : { mihomo: false, 'mihomo-alpha': false })
    }
  }

  useEffect(() => {
    checkPermissions()
  }, [])

  const handleAction = async (action: () => Promise<void>): Promise<void> => {
    setLoading({ mihomo: true, 'mihomo-alpha': true })
    try {
      await action()
      onChange(false)
    } catch (e) {
      // 忽略用户取消操作的错误
      const errorMsg = String(e)
      if (errorMsg.includes('用户取消操作') || errorMsg.includes('UserCancelledError')) {
        // 静默失败，只刷新状态
        await checkPermissions()
        return
      }
      alert(e)
    } finally {
      setLoading({})
    }
  }

  const handleCoreAction = async (
    coreName: 'mihomo' | 'mihomo-alpha',
    isGrant: boolean
  ): Promise<void> => {
    setLoading({ ...loading, [coreName]: true })
    try {
      if (isGrant) {
        await manualGrantCorePermition([coreName])
      } else {
        await revokeCorePermission([coreName])
      }
      await checkPermissions()
    } catch (e) {
      // 忽略用户取消操作的错误
      const errorMsg = String(e)
      if (errorMsg.includes('用户取消操作') || errorMsg.includes('UserCancelledError')) {
        // 静默失败，只刷新状态
        await checkPermissions()
        return
      }
      alert(e)
    } finally {
      setLoading({ ...loading, [coreName]: false })
    }
  }

  const getStatusText = (coreName: 'mihomo' | 'mihomo-alpha'): string => {
    if (hasPermission === null) return t('mihomo.permission.checking')
    if (typeof hasPermission === 'boolean') {
      return hasPermission ? t('mihomo.permission.authorized') : t('mihomo.permission.unauthorized')
    }
    return hasPermission[coreName]
      ? t('mihomo.permission.authorized')
      : t('mihomo.permission.unauthorized')
  }

  const getStatusColor = (coreName: 'mihomo' | 'mihomo-alpha'): string => {
    if (hasPermission === null) return 'bg-default-400 animate-pulse'
    if (typeof hasPermission === 'boolean') {
      return hasPermission ? 'bg-success' : 'bg-warning'
    }
    return hasPermission[coreName] ? 'bg-success' : 'bg-warning'
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
          <span>
            {isWindows ? t('mihomo.permission.taskTitle') : t('mihomo.permission.coreTitle')}
          </span>
          <SecondaryModalCloseButton onPress={() => onChange(false)} />
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            {isWindows ? (
              <>
                <Card
                  shadow="sm"
                  className="border-none bg-gradient-to-br from-default-50 to-default-100"
                >
                  <CardBody className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {t('mihomo.permission.taskStatus')}
                        </span>
                      </div>
                      <Chip
                        color={
                          typeof hasPermission === 'boolean'
                            ? hasPermission
                              ? 'success'
                              : 'warning'
                            : 'default'
                        }
                        variant="flat"
                        size="sm"
                      >
                        {hasPermission === null
                          ? t('mihomo.permission.checkingDots')
                          : typeof hasPermission === 'boolean'
                            ? hasPermission
                              ? t('mihomo.permission.registered')
                              : t('mihomo.permission.unregistered')
                            : t('common.unknown')}
                      </Chip>
                    </div>
                  </CardBody>
                </Card>

                <Divider />

                <div className="text-xs text-default-500 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5">•</span>
                    <span>{t('mihomo.permission.taskHint1')}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5">•</span>
                    <span>{t('mihomo.permission.taskHint2')}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5">•</span>
                    <span>{t('mihomo.permission.taskHint3')}</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-3">
                  <Card shadow="sm" className="border-none">
                    <CardHeader className="pb-0 pt-4 px-4 flex-col items-start">
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-medium">
                            {t('mihomo.permission.stableCore')}
                          </h4>
                        </div>
                        <Chip
                          color={getStatusColor('mihomo') === 'bg-success' ? 'success' : 'warning'}
                          variant="flat"
                          size="sm"
                        >
                          {getStatusText('mihomo')}
                        </Chip>
                      </div>
                    </CardHeader>
                    <CardBody className="pt-3 px-4 pb-4">
                      {typeof hasPermission !== 'boolean' && hasPermission?.mihomo ? (
                        <Button
                          size="sm"
                          color="warning"
                          variant="flat"
                          onPress={() => handleCoreAction('mihomo', false)}
                          isLoading={loading.mihomo}
                          fullWidth
                        >
                          {t('mihomo.permission.revoke')}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          color="primary"
                          variant="shadow"
                          onPress={() => handleCoreAction('mihomo', true)}
                          isLoading={loading.mihomo}
                          fullWidth
                        >
                          {t('mihomo.permission.grant')}
                        </Button>
                      )}
                    </CardBody>
                  </Card>

                  <Card shadow="sm" className="border-none">
                    <CardHeader className="pb-0 pt-4 px-4 flex-col items-start">
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-medium">
                            {t('mihomo.permission.alphaCore')}
                          </h4>
                        </div>
                        <Chip
                          color={
                            getStatusColor('mihomo-alpha') === 'bg-success' ? 'success' : 'warning'
                          }
                          variant="flat"
                          size="sm"
                        >
                          {getStatusText('mihomo-alpha')}
                        </Chip>
                      </div>
                    </CardHeader>
                    <CardBody className="pt-3 px-4 pb-4">
                      {typeof hasPermission !== 'boolean' && hasPermission?.['mihomo-alpha'] ? (
                        <Button
                          size="sm"
                          color="warning"
                          variant="flat"
                          onPress={() => handleCoreAction('mihomo-alpha', false)}
                          isLoading={loading['mihomo-alpha']}
                          fullWidth
                        >
                          {t('mihomo.permission.revoke')}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          color="primary"
                          variant="shadow"
                          onPress={() => handleCoreAction('mihomo-alpha', true)}
                          isLoading={loading['mihomo-alpha']}
                          fullWidth
                        >
                          {t('mihomo.permission.grant')}
                        </Button>
                      )}
                    </CardBody>
                  </Card>
                </div>

                <div className="text-xs text-default-500 space-y-2">
                  <div className="flex items-start gap-2">
                    <span>{t('mihomo.permission.coreHint1')}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span>{t('mihomo.permission.coreHint2')}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </ModalBody>
        <ModalFooter className="space-x-2">
          <Button
            size="sm"
            variant="light"
            onPress={() => onChange(false)}
            isDisabled={Object.values(loading).some((v) => v)}
          >
            {t('common.close')}
          </Button>
          {isWindows &&
            (() => {
              const hasAnyPermission = typeof hasPermission === 'boolean' ? hasPermission : false
              const isLoading = Object.values(loading).some((v) => v)

              return hasAnyPermission ? (
                <Button
                  size="sm"
                  color="warning"
                  onPress={() => handleAction(onRevoke)}
                  isLoading={isLoading}
                >
                  {t('mihomo.permission.unregisterTask')}
                </Button>
              ) : (
                <Button
                  size="sm"
                  color="primary"
                  onPress={() => handleAction(onGrant)}
                  isLoading={isLoading}
                >
                  {t('mihomo.permission.registerTask')}
                </Button>
              )
            })()}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default PermissionModal
