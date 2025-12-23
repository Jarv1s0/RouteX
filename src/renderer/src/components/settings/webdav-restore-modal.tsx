import { Modal, ModalContent, ModalHeader, ModalBody, Button } from '@heroui/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { relaunchApp, webdavDelete, webdavRestore } from '@renderer/utils/ipc'
import React, { useState } from 'react'
import { MdDeleteForever } from 'react-icons/md'
import { IoClose } from 'react-icons/io5'
interface Props {
  filenames: string[]
  onClose: () => void
}
const WebdavRestoreModal: React.FC<Props> = (props) => {
  const { filenames: names, onClose } = props
  const { appConfig: { disableAnimation = false } = {} } = useAppConfig()
  const [filenames, setFilenames] = useState<string[]>(names)
  const [restoring, setRestoring] = useState(false)

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
          <span>恢复备份</span>
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
          {filenames.length === 0 ? (
            <div className="flex justify-center">还没有备份</div>
          ) : (
            filenames.map((filename) => (
              <div className="flex" key={filename}>
                <Button
                  size="sm"
                  fullWidth
                  isLoading={restoring}
                  variant="flat"
                  onPress={async () => {
                    setRestoring(true)
                    try {
                      await webdavRestore(filename)
                      await relaunchApp()
                    } catch (e) {
                      alert(`恢复失败：${e}`)
                    } finally {
                      setRestoring(false)
                    }
                  }}
                >
                  {filename}
                </Button>
                <Button
                  size="sm"
                  color="warning"
                  variant="flat"
                  className="ml-2"
                  onPress={async () => {
                    try {
                      await webdavDelete(filename)
                      setFilenames(filenames.filter((name) => name !== filename))
                    } catch (e) {
                      alert(`删除失败：${e}`)
                    }
                  }}
                >
                  <MdDeleteForever className="text-lg" />
                </Button>
              </div>
            ))
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default WebdavRestoreModal
