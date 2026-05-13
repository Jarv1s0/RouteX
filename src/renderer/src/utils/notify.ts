import { toast } from 'sonner'
import { translate } from '@renderer/i18n'

type DialogType = 'info' | 'error' | 'warning' | 'success'

interface NotifyOptions {
  title?: string
}

function normalizeMessage(value: unknown): string {
  if (value instanceof Error) {
    return value.message || String(value)
  }
  if (typeof value === 'string') {
    return value
  }
  if (value && typeof value === 'object') {
    if ('invokeError' in value && typeof value.invokeError === 'string') {
      return value.invokeError
    }
    if ('message' in value && typeof value.message === 'string') {
      return value.message
    }
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

function showGlobalDialog(type: DialogType, title: string, content: string): void {
  window.dispatchEvent(
    new CustomEvent('show-global-dialog', {
      detail: { type, title, content }
    })
  )
}

function shouldUseDialog(message: string): boolean {
  return message.length > 120 || message.includes('\n')
}

export function notifyError(error: unknown, options?: NotifyOptions): void {
  const message = normalizeMessage(error)
  const title = options?.title || translate('common.operationFailed')

  if (shouldUseDialog(message)) {
    showGlobalDialog('error', title, message)
    return
  }

  toast.error(message)
}

export function notifyInfo(message: unknown, options?: NotifyOptions): void {
  const normalized = normalizeMessage(message)
  const title = options?.title || translate('common.notice')

  if (shouldUseDialog(normalized)) {
    showGlobalDialog('info', title, normalized)
    return
  }

  toast.info(normalized)
}

export function notifySuccess(message: unknown): void {
  toast.success(normalizeMessage(message))
}

export function formatErrorMessage(error: unknown): string {
  return normalizeMessage(error)
}
