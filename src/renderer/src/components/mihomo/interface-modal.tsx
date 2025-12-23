import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Button,
  Snippet
} from '@heroui/react'
import React, { useEffect, useState } from 'react'
import { IoClose } from 'react-icons/io5'
import { getInterfaces } from '@renderer/utils/ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'

interface Props {
  onClose: () => void
}

const InterfaceModal: React.FC<Props> = (props) => {
  const { onClose } = props
  const { appConfig: { disableAnimation = false } = {} } = useAppConfig()
  const [info, setInfo] = useState<Record<string, NetworkInterfaceInfo[]>>({})
  const getInfo = async (): Promise<void> => {
    setInfo(await getInterfaces())
  }

  useEffect(() => {
    getInfo()
  }, [])

  return (
    <Modal
      backdrop={disableAnimation ? 'transparent' : 'blur'}
      disableAnimation={disableAnimation}
      classNames={{ backdrop: 'top-[48px]' }}
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex justify-between items-center app-drag pr-4">
          <span>网络信息</span>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            className="app-nodrag"
            onPress={onClose}
          >
            <IoClose className="text-lg" />
          </Button>
        </ModalHeader>
        <ModalBody className="pb-6">
          {Object.entries(info).map(([key, value]) => {
            return (
              <div key={key}>
                <h4 className="font-bold">{key}</h4>
                {value.map((v) => {
                  return (
                    <div key={v.address}>
                      <div className="mt-2 flex justify-between">
                        {v.family}
                        <Snippet symbol="" size="sm">
                          {v.address}
                        </Snippet>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default InterfaceModal
