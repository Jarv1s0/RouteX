import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react'
import React, { useEffect, useState } from 'react'
import { BaseEditor } from '../base/base-editor-lazy'
import { getFileStr, setFileStr, convertMrsRuleset } from '@renderer/utils/ipc'
import yaml from 'js-yaml'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { Spinner } from '@heroui/react'
type Language = 'yaml' | 'javascript' | 'css' | 'json' | 'text'

interface Props {
  onClose: () => void
  path: string
  type: string
  title: string
  privderType: string
  format?: string
  behavior?: string
}
const Viewer: React.FC<Props> = (props) => {
  const { type, path, title, format, privderType, behavior, onClose } = props
  const { appConfig: { disableAnimation = false } = {} } = useAppConfig()
  const [currData, setCurrData] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  let language: Language = !format || format === 'YamlRule' ? 'yaml' : 'text'

  const getContent = async (): Promise<void> => {
    setIsLoading(true)
    try {
      let fileContent: string
      // 处理 MRS 格式
      if (format === 'MrsRule' || format === 'mrs') {
        fileContent = await convertMrsRuleset(path, behavior || 'domain')
        language = 'text'
      } else if (type === 'Inline') {
        fileContent = await getFileStr('config.yaml')
        language = 'yaml'
      } else {
        fileContent = await getFileStr(path)
      }

      let parsedYaml: unknown
      try {
        parsedYaml = yaml.load(fileContent)
      } catch (e) {
        parsedYaml = null
      }
      if (parsedYaml && typeof parsedYaml === 'object') {
        const yamlObj = parsedYaml as Record<string, unknown>
        const payload = yamlObj[privderType]?.[title]?.payload
        if (payload) {
          if (privderType === 'proxy-providers') {
            setCurrData(
              yaml.dump({
                proxies: payload
              })
            )
          } else {
            setCurrData(
              yaml.dump({
                rules: payload
              })
            )
          }
        } else {
          const targetObj = yamlObj[privderType]?.[title]
          if (targetObj) {
            setCurrData(yaml.dump(targetObj))
          } else {
            setCurrData(fileContent)
          }
        }
      } else {
        setCurrData(fileContent)
      }
    } catch (error) {
      setCurrData('')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    getContent()
  }, [])

  return (
    <Modal
      backdrop={disableAnimation ? 'transparent' : 'blur'}
      disableAnimation={disableAnimation}
      classNames={{
        base: 'max-w-none w-full',
        backdrop: 'top-[48px]'
      }}
      size="5xl"
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent className="h-full w-[calc(100%-100px)]">
        <ModalHeader className="flex pb-0 app-drag">{title}</ModalHeader>
        <ModalBody className="h-full">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Spinner size="lg" />
              <p className="text-default-500">加载中...</p>
            </div>
          ) : (
            <BaseEditor
              language={language}
              value={currData}
              readOnly={type != 'File'}
              onChange={(value) => setCurrData(value)}
            />
          )}
        </ModalBody>
        <ModalFooter className="pt-0">
          <Button size="sm" variant="light" onPress={onClose}>
            关闭
          </Button>
          {type == 'File' && (
            <Button
              size="sm"
              color="primary"
              onPress={async () => {
                await setFileStr(path, currData)
                onClose()
              }}
            >
              保存
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default Viewer
