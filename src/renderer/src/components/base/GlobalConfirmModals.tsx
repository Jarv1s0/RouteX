import React, { useEffect, useState } from 'react'
import ConfirmModal from '@renderer/components/base/base-confirm'
import { platform } from '@renderer/utils/init'

const GlobalConfirmModals: React.FC = () => {
  const [showQuitConfirm, setShowQuitConfirm] = useState(false)
  const [showProfileInstallConfirm, setShowProfileInstallConfirm] = useState(false)
  const [showOverrideInstallConfirm, setShowOverrideInstallConfirm] = useState(false)
  const [profileInstallData, setProfileInstallData] = useState<{
    url: string
    name?: string | null
  }>()
  const [overrideInstallData, setOverrideInstallData] = useState<{
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

    window.electron.ipcRenderer.on('show-quit-confirm', handleShowQuitConfirm)
    window.electron.ipcRenderer.on('show-profile-install-confirm', handleShowProfileInstallConfirm)
    window.electron.ipcRenderer.on(
      'show-override-install-confirm',
      handleShowOverrideInstallConfirm
    )

    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('show-quit-confirm')
      window.electron.ipcRenderer.removeAllListeners('show-profile-install-confirm')
      window.electron.ipcRenderer.removeAllListeners('show-override-install-confirm')
    }
  }, [])

  const handleQuitConfirm = (confirmed: boolean): void => {
    setShowQuitConfirm(false)
    window.electron.ipcRenderer.send('quit-confirm-result', confirmed)
  }

  const handleProfileInstallConfirm = (confirmed: boolean): void => {
    setShowProfileInstallConfirm(false)
    window.electron.ipcRenderer.send('profile-install-confirm-result', confirmed)
  }

  const handleOverrideInstallConfirm = (confirmed: boolean): void => {
    setShowOverrideInstallConfirm(false)
    window.electron.ipcRenderer.send('override-install-confirm-result', confirmed)
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
