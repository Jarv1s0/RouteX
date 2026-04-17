import React, { useEffect, useState } from 'react'
import ConfirmModal from '@renderer/components/base/base-confirm'
import { platform } from '@renderer/utils/init'
import { ON, SEND, onIpc, sendIpc } from '@renderer/utils/ipc-channels'

interface CustomInstallConfirmDetail {
  requestId: string
  url: string
  name?: string | null
}

function dispatchInstallConfirmResult(eventName: string, requestId: string, confirmed: boolean): void {
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
    <>
      {showQuitConfirm && (
        <ConfirmModal
          title="确定要退出 RouteX 吗？"
          description={
            <div>
              <p></p>
              <p className="text-sm text-gray-500 mt-2">退出后代理功能将停止工作</p>
              <p className="text-sm text-gray-400 mt-1">
                快按两次或长按 {platform === 'darwin' ? '⌘Q' : 'Ctrl+Q'} 可直接退出
              </p>
            </div>
          }
          confirmText="退出"
          cancelText="取消"
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
          title="确定要导入订阅配置吗？"
          description={
            <div>
              <p className="text-sm text-gray-600 mb-2">
                名称：{profileInstallData.name || '未命名'}
              </p>
              <p className="text-sm text-gray-600 mb-2">链接：{profileInstallData.url}</p>
              <p className="text-sm text-orange-500 mt-2">
                请确保订阅配置来源可信，恶意配置可能影响您的网络安全
              </p>
            </div>
          }
          confirmText="导入"
          cancelText="取消"
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
          title="确定要导入覆写文件吗？"
          description={
            <div>
              <p className="text-sm text-gray-600 mb-2">
                名称：{overrideInstallData.name || '未命名'}
              </p>
              <p className="text-sm text-gray-600 mb-2">链接：{overrideInstallData.url}</p>
              <p className="text-sm text-orange-500 mt-2">
                请确保覆写文件来源可信，恶意覆写文件可能影响您的网络安全
              </p>
            </div>
          }
          confirmText="导入"
          cancelText="取消"
          onChange={(open) => {
            if (!open) {
              handleOverrideInstallConfirm(false)
            }
          }}
          onConfirm={() => handleOverrideInstallConfirm(true)}
        />
      )}
    </>
  )
}

export default GlobalConfirmModals
