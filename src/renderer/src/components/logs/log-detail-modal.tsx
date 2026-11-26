import { Modal, ModalContent, ModalHeader, ModalBody, Button } from '@heroui/react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useMainPaneModalContentStyle } from '@renderer/hooks/use-main-pane-modal-style'
import { IoCheckmark, IoCopyOutline, IoTimeOutline } from 'react-icons/io5'
import SecondaryModalCloseButton from '@renderer/components/base/secondary-modal-close'
import { createSecondaryModalClassNames } from '@renderer/utils/modal-styles'
import { useI18n } from '@renderer/i18n'
import {
  getLogTagBadgeClass,
  getLogTypeBadgeClass,
  getLogTypeMarkerClass,
  parseLogPayload
} from '@renderer/utils/log-styles'
import { renderLogContent } from '@renderer/components/logs/log-highlight'

interface Props {
  log: ControllerLog & { time?: string }
  onClose: () => void
}

const LogDetailModal: React.FC<Props> = (props) => {
  const { log, onClose } = props
  const { t } = useI18n()
  const modalContentStyle = useMainPaneModalContentStyle(560)
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current)
      }
    }
  }, [])

  const parsed = useMemo(() => parseLogPayload(log.payload), [log.payload])
  const fullLog = `[${log.time || ''}] [${log.type.toUpperCase()}] ${log.payload}`

  const handleCopy = () => {
    navigator.clipboard?.writeText(fullLog)
    setCopied(true)
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current)
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopied(false)
    }, 1500)
  }

  return (
    <Modal
      backdrop="blur"
      classNames={createSecondaryModalClassNames({
        base: 'overflow-hidden'
      })}
      size="lg"
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent style={modalContentStyle}>
        <ModalHeader className="flex items-center justify-between gap-2 app-drag pl-3 pr-2 py-2 relative">
          <div
            className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full ${getLogTypeMarkerClass(log.type)}`}
          />
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-sm font-bold tracking-tight">{t('page.logs.detail')}</span>
            <span
              className={`px-1.5 py-0.5 rounded-md border text-[10px] leading-none font-bold uppercase tracking-wider ${getLogTypeBadgeClass(log.type, 'detail')}`}
            >
              {log.type}
            </span>
            {parsed.tag && (
              <span
                className={`px-1.5 py-0.5 rounded-md border text-[10px] leading-none font-semibold ${getLogTagBadgeClass(parsed.tag)}`}
              >
                {parsed.tag}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="flat"
              startContent={
                copied ? (
                  <IoCheckmark className="text-xs text-success" />
                ) : (
                  <IoCopyOutline className="text-xs" />
                )
              }
              className={`app-nodrag min-w-0 px-3 h-7 text-xs transition-colors ${
                copied
                  ? 'bg-success/15 text-success'
                  : 'bg-default-100/70 hover:bg-default-200/70 text-foreground/80'
              }`}
              onPress={handleCopy}
            >
              {t('common.copy')}
            </Button>
            <SecondaryModalCloseButton onPress={onClose} className="h-7 w-7 min-w-7" />
          </div>
        </ModalHeader>

        <ModalBody className="p-2">
          <div className="rounded-xl border border-default-200/70 dark:border-white/10 bg-default-100/50 dark:bg-black/25 overflow-hidden">
            <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-default-200/50 dark:border-white/5 bg-default-100/40 dark:bg-white/[0.03] text-[11px] text-default-500">
              <div className="flex items-center gap-1.5 font-mono tabular-nums select-text">
                <IoTimeOutline className="text-xs text-default-400" />
                <span>{log.time || '-'}</span>
                {log.shortTime && (
                  <span className="text-[10px] text-default-400">({log.shortTime})</span>
                )}
              </div>
              {parsed.quickFilterToken && parsed.quickFilterToken !== parsed.tag && (
                <span className="px-1.5 py-0.5 rounded bg-default-200/60 dark:bg-white/10 font-mono text-[10px] text-foreground/80 select-text">
                  {parsed.quickFilterToken}
                </span>
              )}
            </div>
            <div className="p-2.5 max-h-[50vh] overflow-y-auto custom-scrollbar">
              <pre className="text-[13px] font-mono leading-relaxed whitespace-pre-wrap break-all select-text text-foreground/90">
                {renderLogContent(parsed.rest)}
              </pre>
            </div>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default LogDetailModal
