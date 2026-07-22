import { Button } from '@heroui/react'
import React, { Suspense, useEffect, useState } from 'react'
import { FiDownload } from 'react-icons/fi'
import { cancelUpdate } from '@renderer/api/app'
import { useI18n } from '@renderer/i18n'
import { ON, onIpc } from '@renderer/utils/ipc-channels'

const UpdaterModal = React.lazy(() => import('./updater-modal'))

interface Props {
  latest?: {
    version: string
    releaseNotes: string
  }
}

const UpdaterButton: React.FC<Props> = (props) => {
  const { latest } = props
  const { t } = useI18n()
  const [openModal, setOpenModal] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<{
    downloading: boolean
    progress: number
    error?: string
  }>({
    downloading: false,
    progress: 0
  })

  useEffect(() => {
    const handleUpdateStatus = (
      _: Electron.IpcRendererEvent,
      status: typeof updateStatus
    ): void => {
      setUpdateStatus(status)
    }

    return onIpc(ON.updateStatus, handleUpdateStatus)
  }, [])

  const handleCancelUpdate = async (): Promise<void> => {
    try {
      await cancelUpdate()
      setUpdateStatus({ downloading: false, progress: 0 })
    } catch {
      // ignore
    }
  }

  if (!latest) return null
  const updateLabel = t('sidebar.newVersion', { version: latest.version })

  return (
    <>
      {openModal && (
        <Suspense fallback={null}>
          <UpdaterModal
            version={latest.version}
            releaseNotes={latest.releaseNotes}
            updateStatus={updateStatus}
            onCancel={handleCancelUpdate}
            onClose={() => {
              setOpenModal(false)
            }}
          />
        </Suspense>
      )}
      <Button
        isIconOnly
        aria-label={updateLabel}
        className="app-nodrag h-8 w-8 min-w-8 rounded-lg p-0"
        color="danger"
        size="sm"
        title={updateLabel}
        variant="light"
        onPress={() => {
          setOpenModal(true)
        }}
      >
        <FiDownload className="text-[18px]" />
      </Button>
    </>
  )
}

export default UpdaterButton
