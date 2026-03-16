import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Snippet
} from '@heroui/react'
import React, { useEffect, useState } from 'react'
import { getInterfaces } from '@renderer/utils/ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import SecondaryModalCloseButton from '@renderer/components/base/secondary-modal-close'
import {
  createSecondaryModalClassNames,
  SECONDARY_MODAL_HEADER_CLASSNAME
} from '@renderer/utils/modal-styles'

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
      classNames={createSecondaryModalClassNames()}
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className={SECONDARY_MODAL_HEADER_CLASSNAME}>
          <span>网络信息</span>
          <SecondaryModalCloseButton onPress={onClose} />
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
