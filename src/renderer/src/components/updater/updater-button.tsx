import { Button } from '@heroui/react'
import React, { Suspense, useEffect, useState } from 'react'
import { LuArrowDownToLine } from 'react-icons/lu'
import { cancelUpdate } from '@renderer/api/app'
import { useI18n } from '@renderer/i18n'
import { ON, onIpc } from '@renderer/utils/ipc-channels'

const UpdaterModal = React.lazy(() => import('./updater-modal'))

interface Props {
  latest?: {
    version: string
    releaseNotes: string
  }
  compact?: boolean
}

const UpdaterButton: React.FC<Props> = (props) => {
  const { latest, compact = false } = props
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
        className={`app-nodrag group relative h-8 w-8 min-w-8 rounded-xl border p-0 backdrop-blur-sm transition-all duration-200 ${
          compact
            ? 'border-primary/25 bg-gradient-to-br from-cyan-500/12 via-blue-500/10 to-indigo-500/15 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_2px_6px_rgba(0,112,243,0.1)] hover:border-primary/45 hover:from-cyan-500/18 hover:via-blue-500/16 hover:to-indigo-500/22 dark:border-cyan-400/25 dark:from-cyan-400/15 dark:via-blue-500/12 dark:to-indigo-500/18 dark:text-cyan-300 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_2px_8px_rgba(0,0,0,0.28)] dark:hover:border-cyan-400/40'
            : 'border-primary/20 bg-primary/10 text-primary hover:border-primary/35 hover:bg-primary/18 dark:border-cyan-400/20 dark:bg-cyan-400/12 dark:text-cyan-300 dark:hover:bg-cyan-400/20'
        }`}
        color="primary"
        size="sm"
        title={updateLabel}
        variant="light"
        onPress={() => {
          setOpenModal(true)
        }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1.5 right-1.5 flex h-1.5 w-1.5 items-center justify-center"
        >
          <span className="absolute inline-flex h-2.5 w-2.5 rounded-full bg-cyan-400/60 opacity-75 animate-ping" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-500 dark:bg-cyan-300" />
        </span>
        <LuArrowDownToLine className="text-[15px] transition-transform duration-200 group-hover:translate-y-0.5" />
      </Button>
    </>
  )
}

export default UpdaterButton
