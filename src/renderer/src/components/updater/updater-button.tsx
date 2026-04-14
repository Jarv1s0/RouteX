import { Button } from '@heroui/react'
import React, { Suspense, useEffect, useState } from 'react'
import { GrUpgrade } from 'react-icons/gr'
import { cancelUpdate } from '@renderer/api/app'
import { ON, onIpc } from '@renderer/utils/ipc-channels'

const UpdaterModal = React.lazy(() => import('./updater-modal'))

interface Props {
  iconOnly?: boolean
  latest?: {
    version: string
    releaseNotes: string
  }
}

const UpdaterButton: React.FC<Props> = (props) => {
  const { iconOnly, latest } = props
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
    } catch (e) {
      // ignore
    }
  }

  if (!latest) return null

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
      {iconOnly ? (
        <Button
          isIconOnly
          className={`app-nodrag`}
          color="danger"
          size="md"
          onPress={() => {
            setOpenModal(true)
          }}
        >
          <GrUpgrade />
        </Button>
      ) : (
        <Button
          isIconOnly
          className={`fixed right-[45px] app-nodrag`}
          color="danger"
          size="sm"
          onPress={() => {
            setOpenModal(true)
          }}
        >
          <GrUpgrade />
        </Button>
      )}
    </>
  )
}

export default UpdaterButton
