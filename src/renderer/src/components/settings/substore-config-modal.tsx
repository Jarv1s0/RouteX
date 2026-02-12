import React, { useState, useEffect } from 'react'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input, Switch } from '@heroui/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { startSubStoreFrontendServer, startSubStoreBackendServer, stopSubStoreBackendServer } from '@renderer/utils/ipc'
import debounce from '@renderer/utils/debounce'
import { isValidCron } from 'cron-validator'

interface Props {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

const SubStoreConfigModal: React.FC<Props> = ({ isOpen, onOpenChange }) => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    useSubStore = true,
    useCustomSubStore = false,
    useProxyInSubStore = false,
    subStoreHost = '127.0.0.1',
    customSubStoreUrl = '',
    subStoreBackendSyncCron = '',
    subStoreBackendDownloadCron = '',
    subStoreBackendUploadCron = ''
  } = appConfig || {}

  const [customSubStoreUrlValue, setCustomSubStoreUrlValue] = useState(customSubStoreUrl)
  const [syncCron, setSyncCron] = useState(subStoreBackendSyncCron)
  const [downloadCron, setDownloadCron] = useState(subStoreBackendDownloadCron)
  const [uploadCron, setUploadCron] = useState(subStoreBackendUploadCron)

  useEffect(() => {
    setCustomSubStoreUrlValue(customSubStoreUrl)
    setSyncCron(subStoreBackendSyncCron)
    setDownloadCron(subStoreBackendDownloadCron)
    setUploadCron(subStoreBackendUploadCron)
  }, [isOpen])

  const debouncedUrl = debounce(async (v: string) => {
    await patchAppConfig({ customSubStoreUrl: v })
  }, 500)

  // 辅助组件：配置项卡片
  const ConfigCard: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; className?: string }> = ({ 
    title, 
    subtitle, 
    children, 
    className = "" 
  }) => (
    <div className={`group flex items-center justify-between gap-4 p-3 rounded-xl bg-content1/50 hover:bg-content1 border border-default-100 hover:border-default-200 transition-all duration-300 shadow-sm hover:shadow-md ${className}`}>
      <div className="flex flex-col gap-0.5 overflow-hidden">
        <span className="font-medium text-foreground-600 group-hover:text-foreground-900 transition-colors whitespace-nowrap">
          {title}
        </span>
        {subtitle && (
          <span className="text-xs text-default-400 group-hover:text-default-500 transition-colors whitespace-nowrap">
            {subtitle}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {children}
      </div>
    </div>
  )

  // 辅助组件：Cron 输入
  const CronInput: React.FC<{ value: string; original: string; field: string; placeholder?: string }> = ({ 
    value, 
    original, 
    field,
    placeholder = "Cron 表达式"
  }) => (
    <div className="flex gap-2 w-48">
      <Input
        size="sm"
        value={value}
        placeholder={placeholder}
        variant="bordered"
        classNames={{
          input: "bg-transparent text-xs",
          inputWrapper: "border border-default-200 bg-default-100/50 shadow-sm rounded-2xl hover:bg-default-200/50 h-8 min-h-8"
        }}
        onValueChange={(v) => {
          if (field === 'sync') setSyncCron(v)
          else if (field === 'download') setDownloadCron(v)
          else if (field === 'upload') setUploadCron(v)
        }}
      />
      {value !== original && (
        <Button 
          size="sm" 
          color="primary" 
          variant="flat"
          className="h-8 min-w-12 px-2 text-xs font-medium"
          onPress={async () => {
            if (!value || isValidCron(value)) {
              await patchAppConfig({ [`subStoreBackend${field.charAt(0).toUpperCase() + field.slice(1)}Cron`]: value })
              new Notification('重启应用生效')
            } else alert('Cron 表达式无效')
          }}
        >
          保存
        </Button>
      )}
    </div>
  )

  return (
    <Modal 
      isOpen={isOpen} 
      onOpenChange={onOpenChange} 
      size="2xl" 
      backdrop="blur"
      scrollBehavior="inside"
      classNames={{
        base: "bg-background/80 backdrop-blur-xl border border-white/10 shadow-2xl",
        header: "border-b border-default-100",
        footer: "border-t border-default-100",
        closeButton: "hover:bg-danger hover:text-white active:bg-danger/90 text-default-500 transition-colors z-50"
      }}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1 py-2 px-4">
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
                Sub-Store 服务配置
              </span>
              <span className="text-small text-default-400 font-normal">
                管理 Sub-Store 的后端服务、网络连接及定时任务
              </span>
            </ModalHeader>
            <ModalBody className="py-2 px-4">
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <ConfigCard title="允许局域网连接" subtitle="监听 0.0.0.0">
                    <Switch 
                      size="sm" 
                      color="primary"
                      isSelected={subStoreHost === '0.0.0.0'} 
                      onValueChange={async (v) => {
                        await patchAppConfig({ subStoreHost: v ? '0.0.0.0' : '127.0.0.1' })
                        if (useSubStore) {
                          await startSubStoreFrontendServer(); await startSubStoreBackendServer()
                        }
                      }} 
                    />
                  </ConfigCard>

                  <ConfigCard title="使用自建后端" subtitle="连接外部 Sub-Store">
                    <Switch 
                      size="sm" 
                      color="primary"
                      isSelected={useCustomSubStore} 
                      onValueChange={async (v) => {
                        await patchAppConfig({ useCustomSubStore: v })
                        if (v) await stopSubStoreBackendServer(); else await startSubStoreBackendServer()
                      }} 
                    />
                  </ConfigCard>
                </div>

                {useCustomSubStore ? (
                  <ConfigCard title="后端地址" subtitle="自定义 Sub-Store 后端 URL" className="w-full">
                    <Input 
                      size="sm" 
                      className="w-64" 
                      variant="bordered"
                      classNames={{ 
                        input: "bg-transparent",
                        inputWrapper: "border border-default-200 bg-default-100/50 shadow-sm rounded-2xl hover:bg-default-200/50" 
                      }}
                      placeholder="http://..."
                      value={customSubStoreUrlValue} 
                      onValueChange={(v) => {
                        setCustomSubStoreUrlValue(v); debouncedUrl(v)
                      }} 
                    />
                  </ConfigCard>
                ) : (
                  <>
                    <ConfigCard title="启用请求代理" subtitle="为 Sub-Store 所有请求走代理">
                      <Switch 
                        size="sm" 
                        color="primary"
                        isSelected={useProxyInSubStore} 
                        onValueChange={async (v) => {
                          await patchAppConfig({ useProxyInSubStore: v })
                          if (useSubStore) await startSubStoreBackendServer()
                        }} 
                      />
                    </ConfigCard>

                    <div className="flex flex-col gap-2">
                      <ConfigCard title="定时同步" subtitle="自动同步订阅和文件">
                        <CronInput value={syncCron} original={subStoreBackendSyncCron} field="sync" />
                      </ConfigCard>
                      <ConfigCard title="定时恢复" subtitle="自动从 Gist 恢复配置">
                        <CronInput value={downloadCron} original={subStoreBackendDownloadCron} field="download" />
                      </ConfigCard>
                      <ConfigCard title="定时备份" subtitle="自动上传配置到 Gist">
                        <CronInput value={uploadCron} original={subStoreBackendUploadCron} field="upload" />
                      </ConfigCard>
                    </div>
                  </>
                )}
              </div>
            </ModalBody>
            <ModalFooter className="py-2 px-4">
              <Button 
                color="primary" 
                variant="shadow" 
                onPress={onClose}
                className="font-medium px-8"
              >
                完成
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}

export default SubStoreConfigModal
