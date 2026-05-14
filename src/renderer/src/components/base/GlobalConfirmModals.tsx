import React, { useEffect, useState } from 'react'
import { platform } from '@renderer/utils/init'
import { ON, SEND, onIpc, sendIpc } from '@renderer/utils/ipc-channels'
import { useI18n } from '@renderer/i18n'

const ConfirmModal = React.lazy(() => import('@renderer/components/base/base-confirm'))

interface CustomInstallConfirmDetail {
  requestId: string
  url: string
  name?: string | null
}

function dispatchInstallConfirmResult(
  eventName: string,
  requestId: string,
  confirmed: boolean
): void {
  window.dispatchEvent(
    new CustomEvent(eventName, {
      detail: {
        requestId,
        confirmed
      }
    })
  )
}

const GlobalConfirmModals: React.FC = () => {
  const { t } = useI18n()
  const [showQuitConfirm, setShowQuitConfirm] = useState(false)
  const [showProfileInstallConfirm, setShowProfileInstallConfirm] = useState(false)
  const [showOverrideInstallConfirm, setShowOverrideInstallConfirm] = useState(false)
  const [profileInstallData, setProfileInstallData] = useState<{
    requestId?: string
    url: string
    name?: string | null
  }>()
  const [overrideInstallData, setOverrideInstallData] = useState<{
    requestId?: string
    url: string
    name?: string | null
  }>()

  useEffect(() => {
    const handleShowQuitConfirm = (): void => {
      setShowQuitConfirm(true)
    }
    const handleShowProfileInstallConfirm = (
      _event: unknown,
      data: { url: string; name?: string | null }
    ): void => {
      setProfileInstallData(data)
      setShowProfileInstallConfirm(true)
    }
    const handleShowOverrideInstallConfirm = (
      _event: unknown,
      data: { url: string; name?: string | null }
    ): void => {
      setOverrideInstallData(data)
      setShowOverrideInstallConfirm(true)
    }
    const handleShowProfileInstallConfirmCustom = (event: Event): void => {
      const detail = (event as CustomEvent<CustomInstallConfirmDetail>).detail
      if (!detail?.requestId) {
        return
      }

      setProfileInstallData(detail)
      setShowProfileInstallConfirm(true)
    }
    const handleShowOverrideInstallConfirmCustom = (event: Event): void => {
      const detail = (event as CustomEvent<CustomInstallConfirmDetail>).detail
      if (!detail?.requestId) {
        return
      }

      setOverrideInstallData(detail)
      setShowOverrideInstallConfirm(true)
    }

    const offQuitConfirm = onIpc(ON.showQuitConfirm, handleShowQuitConfirm)
    const offProfileInstallConfirm = onIpc(
      ON.showProfileInstallConfirm,
      handleShowProfileInstallConfirm
    )
    const offOverrideInstallConfirm = onIpc(
      ON.showOverrideInstallConfirm,
      handleShowOverrideInstallConfirm
    )

    window.addEventListener(
      'routex:show-profile-install-confirm',
      handleShowProfileInstallConfirmCustom
    )
    window.addEventListener(
      'routex:show-override-install-confirm',
      handleShowOverrideInstallConfirmCustom
    )

    const cleanupCustomListeners = (): void => {
      window.removeEventListener(
        'routex:show-profile-install-confirm',
        handleShowProfileInstallConfirmCustom
      )
      window.removeEventListener(
        'routex:show-override-install-confirm',
        handleShowOverrideInstallConfirmCustom
      )
    }

    return (): void => {
      offQuitConfirm()
      offProfileInstallConfirm()
      offOverrideInstallConfirm()
      cleanupCustomListeners()
    }
  }, [])

  const handleQuitConfirm = (confirmed: boolean): void => {
    setShowQuitConfirm(false)
    sendIpc(SEND.quitConfirmResult, confirmed)
  }

  const handleProfileInstallConfirm = (confirmed: boolean): void => {
    setShowProfileInstallConfirm(false)
    if (profileInstallData?.requestId) {
      dispatchInstallConfirmResult(
        'routex:profile-install-confirm-result',
        profileInstallData.requestId,
        confirmed
      )
    } else {
      sendIpc(SEND.profileInstallConfirmResult, confirmed)
    }
    setProfileInstallData(undefined)
  }

  const handleOverrideInstallConfirm = (confirmed: boolean): void => {
    setShowOverrideInstallConfirm(false)
    if (overrideInstallData?.requestId) {
      dispatchInstallConfirmResult(
        'routex:override-install-confirm-result',
        overrideInstallData.requestId,
        confirmed
      )
    } else {
      sendIpc(SEND.overrideInstallConfirmResult, confirmed)
    }
    setOverrideInstallData(undefined)
  }

  return (
    <React.Suspense fallback={null}>
      {showQuitConfirm && (
        <ConfirmModal
          title={t('confirm.quitTitle')}
          description={
            <div>
              <p></p>
              <p className="text-sm text-gray-500 mt-2">{t('confirm.quitDescription')}</p>
              <p className="text-sm text-gray-400 mt-1">
                {t('confirm.quitShortcut', {
                  shortcut: platform === 'darwin' ? '⌘Q' : 'Ctrl+Q'
                })}
              </p>
            </div>
          }
          confirmText={t('common.quit')}
          cancelText={t('common.cancel')}
          onChange={(open) => {
            if (!open) {
              handleQuitConfirm(false)
            }
          }}
          onConfirm={() => handleQuitConfirm(true)}
        />
      )}
      {showProfileInstallConfirm && profileInstallData && (
        <ConfirmModal
          title={t('confirm.importProfileTitle')}
          description={
            <div>
              <p className="text-sm text-gray-600 mb-2">
                {t('confirm.name')}: {profileInstallData.name || t('confirm.unnamed')}
              </p>
              <p className="text-sm text-gray-600 mb-2">
                {t('confirm.link')}: {profileInstallData.url}
              </p>
              <p className="text-sm text-orange-500 mt-2">{t('confirm.profileTrustWarning')}</p>
            </div>
          }
          confirmText={t('common.import')}
          cancelText={t('common.cancel')}
          onChange={(open) => {
            if (!open) {
              handleProfileInstallConfirm(false)
            }
          }}
          onConfirm={() => handleProfileInstallConfirm(true)}
          className="w-[500px]"
        />
      )}
      {showOverrideInstallConfirm && overrideInstallData && (
        <ConfirmModal
          title={t('confirm.importOverrideTitle')}
          description={
            <div>
              <p className="text-sm text-gray-600 mb-2">
                {t('confirm.name')}: {overrideInstallData.name || t('confirm.unnamed')}
              </p>
              <p className="text-sm text-gray-600 mb-2">
                {t('confirm.link')}: {overrideInstallData.url}
              </p>
              <p className="text-sm text-orange-500 mt-2">{t('confirm.overrideTrustWarning')}</p>
            </div>
          }
          confirmText={t('common.import')}
          cancelText={t('common.cancel')}
          onChange={(open) => {
            if (!open) {
              handleOverrideInstallConfirm(false)
            }
          }}
          onConfirm={() => handleOverrideInstallConfirm(true)}
        />
      )}
    </React.Suspense>
  )
}

export default GlobalConfirmModals
