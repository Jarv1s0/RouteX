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
import { useMainPaneModalContentStyle } from '@renderer/hooks/use-main-pane-modal-style'
import { FiX, FiDownload } from 'react-icons/fi'
import { createSecondaryModalClassNames } from '@renderer/utils/modal-styles'
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
  const { version, releaseNotes, updateStatus, onClose, onCancel } = props
  const modalContentStyle = useMainPaneModalContentStyle(560, 48)
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
      if (onCancel) {
        onCancel()
      }
      return
    }
    onClose()
  }

  const isDownloading = updateStatus?.downloading || downloading

  return (
    <Modal
      backdrop="blur"
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
      isDismissable={!isDownloading}
      size="md"
      classNames={createSecondaryModalClassNames({
        body: 'p-0',
        footer: 'px-5 py-4'
      })}
    >
      <ModalContent
        className="w-full max-h-[min(720px,calc(100vh-96px))]"
        style={modalContentStyle}
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
              <div className="text-xs font-normal text-default-500">
                {t('updater.releaseNotes')}
              </div>
            </div>
          </div>
          {!isDownloading && (
            <Button
              color="primary"
              size="sm"
              variant="flat"
              className="shrink-0 app-nodrag"
              onPress={() => {
                if (version.includes('-autobuild.')) {
                  open('https://github.com/Jarv1s0/RouteX/releases/tag/autobuild-main')
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
        <ModalFooter className={updateStatus?.downloading ? 'flex-col items-stretch gap-3' : ''}>
          {updateStatus?.downloading ? (
            <div className="w-full space-y-2 px-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-default-600">{t('updater.downloadProgress')}</span>
                <span className="font-medium">{updateStatus.progress}%</span>
              </div>
              <Progress
                value={updateStatus.progress}
                color="primary"
                size="sm"
                showValueLabel={false}
              />
              {updateStatus.error && (
                <div className="text-danger text-sm mt-1">{updateStatus.error}</div>
              )}
              <div className="flex justify-end pt-2">
                <Button size="sm" variant="light" onPress={handleCancel}>
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Button size="sm" variant="light" onPress={handleCancel} startContent={<FiX />}>
                {t('common.cancel')}
              </Button>
              <Button
                size="sm"
                color="primary"
                isLoading={downloading}
                startContent={<FiDownload />}
                onPress={onUpdate}
              >
                {t('updater.updateNow')}
              </Button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default UpdaterModal
