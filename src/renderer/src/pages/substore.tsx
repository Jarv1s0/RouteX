import { Button } from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import {
  subStoreFrontendPort,
  subStorePort,
  startSubStoreFrontendServer,
  startSubStoreBackendServer,
  stopSubStoreFrontendServer,
  stopSubStoreBackendServer,
  downloadSubStore
} from '@renderer/utils/ipc'
import React, { useEffect, useState } from 'react'
import { HiExternalLink } from 'react-icons/hi'
import { IoMdCloudDownload } from 'react-icons/io'
import { useTheme } from 'next-themes'

const SubStore: React.FC = () => {
  const { appConfig } = useAppConfig()
  const { useCustomSubStore, customSubStoreUrl } = appConfig || {}
  const [backendPort, setBackendPort] = useState<number | undefined>()
  const [frontendPort, setFrontendPort] = useState<number | undefined>()
  const [isUpdating, setIsUpdating] = useState(false)
  const { theme } = useTheme()
  
  const getPort = async (): Promise<void> => {
    setBackendPort(await subStorePort())
    setFrontendPort(await subStoreFrontendPort())
  }
  useEffect(() => {
    getPort()
  }, [useCustomSubStore])

  if (!useCustomSubStore && !backendPort) return null
  if (!frontendPort) return null
  
  // 确定 URL
  const backendUrl = useCustomSubStore ? customSubStoreUrl : `http://127.0.0.1:${backendPort}`
  const targetTheme = theme === 'dark' || theme === 'light' ? theme : 'system'
  const iframeSrc = `http://127.0.0.1:${frontendPort}?api=${backendUrl}&theme=${targetTheme}`

  return (
    <>
      <BasePage
        title="Sub-Store"
        header={
          <div className="flex gap-2">
            <Button
              title="检查更新"
              isIconOnly
              size="sm"
              className="app-nodrag"
              variant="light"
              isLoading={isUpdating}
              onPress={async () => {
                try {
                  new Notification('Sub-Store 更新中...')
                  setIsUpdating(true)
                  await downloadSubStore()
                  await stopSubStoreBackendServer()
                  await startSubStoreBackendServer()
                  await new Promise((resolve) => setTimeout(resolve, 1000))
                  setFrontendPort(0)
                  await stopSubStoreFrontendServer()
                  await startSubStoreFrontendServer()
                  await getPort()
                  new Notification('Sub-Store 更新完成')
                } catch (e) {
                  new Notification(`Sub-Store 更新失败：${e}`)
                } finally {
                  setIsUpdating(false)
                }
              }}
            >
              <IoMdCloudDownload className="text-lg" />
            </Button>
            <Button
              title="在浏览器中打开"
              isIconOnly
              size="sm"
              className="app-nodrag"
              variant="light"
              onPress={() => {
                open(iframeSrc)
              }}
            >
              <HiExternalLink className="text-lg" />
            </Button>
          </div>
        }
      >
        <iframe
          className="w-full h-full border-none block"
          allow="clipboard-write; clipboard-read"
          src={iframeSrc}
        />
      </BasePage>
    </>
  )
}

export default SubStore
