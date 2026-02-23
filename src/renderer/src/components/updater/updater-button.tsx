import { Button } from '@heroui/react'
import React, { useState, useEffect } from 'react'
import UpdaterModal from './updater-modal'
import { GrUpgrade } from 'react-icons/gr'
import { cancelUpdate } from '@renderer/utils/ipc'

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

    window.electron.ipcRenderer.on('update-status', handleUpdateStatus)

    return (): void => {
      window.electron.ipcRenderer.removeListener('update-status', handleUpdateStatus)
    }
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
        <UpdaterModal
          version={latest.version}
          releaseNotes={latest.releaseNotes}
          updateStatus={updateStatus}
          onCancel={handleCancelUpdate}
          onClose={() => {
            setOpenModal(false)
          }}
        />
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
