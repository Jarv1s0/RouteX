import React from 'react'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, RadioGroup, Radio } from '@heroui/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'

interface Props {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

const titleMap = {
  sysproxyCardStatus: '系统代理',
  tunCardStatus: '虚拟网卡',
  profileCardStatus: '订阅管理',
  proxyCardStatus: '代理组',
  ruleCardStatus: '规则',
  resourceCardStatus: '外部资源',
  overrideCardStatus: '覆写',
  connectionCardStatus: '连接',
  mihomoCoreCardStatus: '内核',
  dnsCardStatus: 'DNS',
  sniffCardStatus: '域名嗅探',
  logCardStatus: '日志',
  mapCardStatus: '网络拓扑',
  substoreCardStatus: 'Sub-Store',
  statsCardStatus: '统计',
  toolsCardStatus: '工具'
}

const SiderConfigModal: React.FC<Props> = ({ isOpen, onOpenChange }) => {
  const { appConfig, patchAppConfig } = useAppConfig()
  
  const {
    sysproxyCardStatus = 'col-span-1',
    tunCardStatus = 'col-span-1',
    profileCardStatus = 'col-span-2',
    proxyCardStatus = 'col-span-2',
    ruleCardStatus = 'col-span-1',
    resourceCardStatus = 'col-span-1',
    overrideCardStatus = 'col-span-1',
    connectionCardStatus = 'col-span-2',
    mihomoCoreCardStatus = 'col-span-2',
    dnsCardStatus = 'col-span-1',
    sniffCardStatus = 'col-span-1',
    logCardStatus = 'col-span-1',
    mapCardStatus = 'col-span-1',
    substoreCardStatus = 'col-span-1',
    statsCardStatus = 'col-span-1',
    toolsCardStatus = 'col-span-1'
  } = appConfig || {}

  const cardStatus = {
    sysproxyCardStatus,
    tunCardStatus,
    profileCardStatus,
    proxyCardStatus,
    ruleCardStatus,
    resourceCardStatus,
    overrideCardStatus,
    connectionCardStatus,
    mihomoCoreCardStatus,
    dnsCardStatus,
    sniffCardStatus,
    logCardStatus,
    mapCardStatus,
    substoreCardStatus,
    statsCardStatus,
    toolsCardStatus
  }

  return (
    <Modal 
      isOpen={isOpen} 
      onOpenChange={onOpenChange}
      size="3xl"
      scrollBehavior="inside"
      backdrop="blur"
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
                侧边栏卡片配置
              </span>
              <span className="text-small text-default-400 font-normal">
                调整每张卡片在侧边栏中的显示大小或隐藏
              </span>
            </ModalHeader>
            <ModalBody className="py-2 px-4">
              <div className="grid grid-cols-2 gap-2">
                {Object.keys(cardStatus).map((key) => (
                  <div 
                    key={key} 
                    className="group flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-content1/50 hover:bg-content1 border border-default-100 hover:border-default-200 transition-all duration-300 shadow-sm hover:shadow-md"
                  >
                    <span className="whitespace-nowrap shrink-0 text-sm font-medium text-foreground-600 group-hover:text-foreground-900 transition-colors">
                      {titleMap[key]}
                    </span>
                    <RadioGroup
                      orientation="horizontal"
                      size="sm"
                      value={cardStatus[key]}
                      onValueChange={(v) => {
                        patchAppConfig({ [key]: v as any })
                      }}
                      classNames={{
                        wrapper: "gap-2"
                      }}
                    >
                      <Radio value="col-span-2">大</Radio>
                      <Radio value="col-span-1">小</Radio>
                      <Radio value="hidden">隐藏</Radio>
                    </RadioGroup>
                  </div>
                ))}
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

export default SiderConfigModal
