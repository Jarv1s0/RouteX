import { useEffect, useState } from 'react'
import yaml from 'js-yaml'
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react'
import { BaseEditor } from '../base/base-editor-lazy'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { getMainPaneModalContentStyle } from '@renderer/utils/modal-styles'

interface Props {
  bypass: string[]
  onCancel: () => void
  onConfirm: (bypass: string[]) => void
}

interface ParsedYaml {
  bypass?: string[]
}

const ByPassEditorModal: React.FC<Props> = (props) => {
  const { bypass, onCancel, onConfirm } = props
  const { appConfig: { disableAnimation = false, collapseSidebar = false, siderWidth = 250 } = {} } =
    useAppConfig()
  const [currData, setCurrData] = useState<string>('')
  useEffect(() => {
    setCurrData(yaml.dump({ bypass }))
  }, [bypass])
  const handleConfirm = (): void => {
    try {
      const parsed = yaml.load(currData) as ParsedYaml
      if (parsed && Array.isArray(parsed.bypass)) {
        onConfirm(parsed.bypass)
      } else {
        alert('YAML 格式错误')
      }
    } catch (e) {
      alert('YAML 解析失败：' + e)
    }
  }

  return (
    <Modal
      backdrop={disableAnimation ? 'transparent' : 'blur'}
      disableAnimation={disableAnimation}
      classNames={{
        base: 'max-w-none w-full',
        backdrop: 'top-[48px]'
      }}
      style={{ zIndex: 99999 }}
      size="5xl"
      hideCloseButton
      isOpen={true}
      onOpenChange={onCancel}
      scrollBehavior="inside"
    >
      <ModalContent
        className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden"
        style={getMainPaneModalContentStyle({ collapseSidebar, siderWidth, maxWidthPx: 1400 })}
      >
        <ModalHeader className="flex pb-0 app-drag">编辑绕过列表 (YAML)</ModalHeader>
        <ModalBody className="flex-1 min-h-0 overflow-hidden">
          <BaseEditor
            language="yaml"
            value={currData}
            onChange={(value) => setCurrData(value || '')}
          />
        </ModalBody>
        <ModalFooter className="pt-0">
          <Button size="sm" variant="light" onPress={onCancel}>
            取消
          </Button>
          <Button size="sm" color="primary" onPress={handleConfirm}>
            确认
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default ByPassEditorModal
