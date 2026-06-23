import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Spinner
} from '@heroui/react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { BaseEditor } from '../base/base-editor-lazy'
import { getFileStr, setFileStr, convertMrsRuleset } from '@renderer/utils/file-ipc'
import yaml from 'js-yaml'
import { useMainPaneModalContentStyle } from '@renderer/hooks/use-main-pane-modal-style'
import { IoCheckmarkCircle, IoCopy } from 'react-icons/io5'
import SecondaryModalCloseButton from '@renderer/components/base/secondary-modal-close'
import {
  createSecondaryModalClassNames,
  SECONDARY_MODAL_HEADER_CLASSNAME
} from '@renderer/utils/modal-styles'
import { useI18n } from '@renderer/i18n'
import { formatErrorMessage, notifyError } from '@renderer/utils/notify'
import { CustomContextMenu } from '@renderer/components/ui/custom-context-menu'
type Language = 'yaml' | 'javascript' | 'css' | 'json' | 'text'
type ResourceYamlEntry = {
  payload?: unknown
}

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
  const { t } = useI18n()
  const { type, path, title, format, privderType, behavior, onClose } = props
  const modalContentStyle = useMainPaneModalContentStyle(undefined, 100)
  const [currData, setCurrData] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [contextMenu, setContextMenu] = useState({
    isOpen: false,
    x: 0,
    y: 0,
    selectedText: ''
  })
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
      } catch {
        parsedYaml = null
      }
      if (parsedYaml && typeof parsedYaml === 'object') {
        const yamlObj = parsedYaml as Record<string, unknown>
        const providerMap = yamlObj[privderType]
        const targetObj =
          providerMap && typeof providerMap === 'object'
            ? (providerMap as Record<string, ResourceYamlEntry>)[title]
            : undefined
        const payload = targetObj?.payload
        if (payload) {
          const payloadKey = privderType === 'proxy-providers' ? 'proxies' : 'rules'
          setCurrData(yaml.dump({ [payloadKey]: payload }))
        } else if (targetObj) {
          setCurrData(yaml.dump(targetObj))
        } else {
          setCurrData(fileContent)
        }
      } else {
        setCurrData(fileContent)
      }
    } catch (error) {
      setCurrData(`${t('common.operationFailed')}: ${formatErrorMessage(error)}`)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    getContent()
  }, [])

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current)
      }
    }
  }, [])

  const markCopied = useCallback(() => {
    if (copiedTimerRef.current) {
      clearTimeout(copiedTimerRef.current)
    }

    setIsCopied(true)
    copiedTimerRef.current = setTimeout(() => {
      setIsCopied(false)
      copiedTimerRef.current = null
    }, 1200)
  }, [])

  const copyText = useCallback(
    async (text: string) => {
      if (!text) return

      try {
        await navigator.clipboard.writeText(text)
        markCopied()
      } catch (error) {
        const textArea = document.createElement('textarea')
        try {
          textArea.value = text
          textArea.style.position = 'fixed'
          textArea.style.opacity = '0'
          document.body.appendChild(textArea)
          textArea.select()
          document.execCommand('copy')
          markCopied()
        } catch {
          notifyError(error)
        } finally {
          textArea.remove()
        }
      }
    },
    [markCopied]
  )

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }))
  }, [])

  const handleCopy = useCallback(async () => {
    await copyText(currData)
  }, [copyText, currData])

  const handleEditorContextMenu = useCallback((event: MouseEvent) => {
    setContextMenu({
      isOpen: true,
      x: event.clientX,
      y: event.clientY,
      selectedText: window.getSelection()?.toString() || ''
    })
  }, [])

  return (
    <Modal
      backdrop="blur"
      classNames={createSecondaryModalClassNames({
        base: 'max-w-none w-full'
      })}
      size="5xl"
      hideCloseButton
      isOpen={true}
      isDismissable={!contextMenu.isOpen}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent className="flex h-full flex-col overflow-hidden" style={modalContentStyle}>
        <ModalHeader className={SECONDARY_MODAL_HEADER_CLASSNAME}>
          <span>{title}</span>
          <SecondaryModalCloseButton onPress={onClose} />
        </ModalHeader>
        <ModalBody className="min-h-0 flex-1 overflow-hidden !px-6 !pt-1 !pb-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Spinner size="lg" />
              <p className="text-default-500">{t('resources.loading')}</p>
            </div>
          ) : (
            <BaseEditor
              language={language}
              value={currData}
              readOnly={type != 'File'}
              compactPadding
              suppressNativeContextMenu
              onNativeContextMenu={handleEditorContextMenu}
              onChange={(value) => setCurrData(value)}
            />
          )}
        </ModalBody>
        <ModalFooter className="shrink-0 px-6 py-3">
          <Button
            size="sm"
            variant="light"
            isDisabled={isLoading || !currData}
            color={isCopied ? 'success' : 'default'}
            startContent={isCopied ? <IoCheckmarkCircle /> : <IoCopy />}
            onPress={handleCopy}
          >
            {isCopied ? t('common.copied') : t('common.copy')}
          </Button>
          <Button size="sm" variant="light" onPress={onClose}>
            {t('common.close')}
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
              {t('common.save')}
            </Button>
          )}
        </ModalFooter>
        {contextMenu.isOpen && (
          <CustomContextMenu
            isOpen={contextMenu.isOpen}
            onClose={closeContextMenu}
            position={{ x: contextMenu.x, y: contextMenu.y }}
          >
            <div className="flex flex-col">
              <Button
                size="sm"
                variant="light"
                className="h-9 min-w-[120px] justify-start px-3"
                startContent={<IoCopy />}
                onPress={() => {
                  void copyText(contextMenu.selectedText || currData)
                  closeContextMenu()
                }}
              >
                {t('common.copy')}
              </Button>
            </div>
          </CustomContextMenu>
        )}
      </ModalContent>
    </Modal>
  )
}

export default Viewer
