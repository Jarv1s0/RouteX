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
import {
  createSecondaryModalClassNames,
  getMainPaneModalContentStyle
} from '@renderer/utils/modal-styles'
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
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
      isDismissable={!isDownloading}
      size="md"
      classNames={createSecondaryModalClassNames({
        body: 'p-0',
        backdrop: 'top-[48px]',
        footer: 'px-5 py-4'
      })}
    >
      <ModalContent
        className="w-full max-h-[min(720px,calc(100vh-96px))]"
        style={getMainPaneModalContentStyle({
          collapseSidebar,
          siderWidth,
          maxWidthPx: 560,
          viewportPaddingPx: 48
        })}
      >
        <ModalHeader className="flex items-center justify-between gap-4 app-drag px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FiDownload className="text-lg" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-xl font-semibold">
                {t('updater.versionReady', { version })}
              </div>
              <div className="text-xs font-normal text-default-500">{t('updater.releaseNotes')}</div>
            </div>
          </div>
          {!isDownloading && (
            <Button
              color="primary"
              size="sm"
              variant="flat"
              className="shrink-0 app-nodrag"
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
        <ModalBody className="p-0">
          {updateStatus?.downloading && (
            <div className="space-y-3 px-5 pt-5 pb-3 border-b border-default-100 bg-content2/30">
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
          <div className="markdown-body flex-1 max-h-[520px] overflow-y-auto px-5 py-4 text-sm leading-6 select-text">
            <Suspense
              fallback={
                <div className="text-sm text-default-500">{t('updater.loadingReleaseNotes')}</div>
              }
            >
              <ReleaseNotesMarkdown>{releaseNotes}</ReleaseNotesMarkdown>
            </Suspense>
          </div>
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
