import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Progress
} from '@heroui/react'
import React, { Suspense, useState } from 'react'
import { downloadAndInstallUpdate } from '@renderer/api/app'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { FiX, FiDownload } from 'react-icons/fi'
import { getMainPaneModalContentStyle } from '@renderer/utils/modal-styles'
import { useI18n } from '@renderer/i18n'

const ReleaseNotesMarkdown = React.lazy(() => import('./release-notes-markdown'))

interface Props {
  version: string
  releaseNotes: string
  updateStatus?: {
    downloading: boolean
    progress: number
    error?: string
  }
  onCancel?: () => void
  onClose: () => void
}

const UpdaterModal: React.FC<Props> = (props) => {
  const { t } = useI18n()
  const { version, releaseNotes, updateStatus, onClose } = props
  const {
    appConfig: { disableAnimation = false, collapseSidebar = false, siderWidth = 250 } = {}
  } = useAppConfig()
  const [downloading, setDownloading] = useState(false)
  const onUpdate = async (): Promise<void> => {
    try {
      setDownloading(true)
      await downloadAndInstallUpdate(version)
    } catch (e) {
      alert(e)
      setDownloading(false)
    }
  }
  const handleCancel = (): void => {
    if (updateStatus?.downloading) {
      return
    }
    onClose()
  }

  const isDownloading = updateStatus?.downloading || downloading

  return (
    <Modal
      backdrop={disableAnimation ? 'transparent' : 'blur'}
      disableAnimation={disableAnimation}
      classNames={{ backdrop: 'top-[48px]' }}
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
      isDismissable={!isDownloading}
    >
      <ModalContent
        className="h-full"
        style={getMainPaneModalContentStyle({
          collapseSidebar,
          siderWidth,
          viewportPaddingPx: 100
        })}
      >
        <ModalHeader className="flex justify-between app-drag">
          <div className="flex items-center gap-2">
            <FiDownload className="text-lg" />
            {t('updater.versionReady', { version })}
          </div>
          {!isDownloading && (
            <Button
              color="primary"
              size="sm"
              className="flex app-nodrag"
              onPress={() => {
                if (version.includes('beta')) {
                  open('https://github.com/Jarv1s0/RouteX/releases/tag/pre-release')
                  return
                }
                open(`https://github.com/Jarv1s0/RouteX/releases/tag/v${version}`)
              }}
            >
              {t('updater.openDownload')}
            </Button>
          )}
        </ModalHeader>
        <ModalBody className="h-full">
          {updateStatus?.downloading && (
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-default-600">{t('updater.downloadProgress')}</span>
                <span className="text-sm font-medium">{updateStatus.progress}%</span>
              </div>
              <Progress
                value={updateStatus.progress}
                color="primary"
                size="sm"
                showValueLabel={false}
              />
              {updateStatus.error && (
                <div className="text-danger text-sm">{updateStatus.error}</div>
              )}
            </div>
          )}
          {!updateStatus?.downloading && (
            <div className="markdown-body select-text">
              <Suspense fallback={<div className="text-sm text-default-500">{t('updater.loadingReleaseNotes')}</div>}>
                <ReleaseNotesMarkdown>{releaseNotes}</ReleaseNotesMarkdown>
              </Suspense>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            size="sm"
            variant="light"
            isDisabled={updateStatus?.downloading}
            onPress={handleCancel}
            startContent={!updateStatus?.downloading ? <FiX /> : undefined}
          >
            {updateStatus?.downloading ? t('updater.downloading') : t('common.cancel')}
          </Button>
          {!updateStatus?.downloading && (
            <Button
              size="sm"
              color="primary"
              isLoading={downloading}
              startContent={<FiDownload />}
              onPress={onUpdate}
            >
              {t('updater.updateNow')}
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default UpdaterModal
