import React, { useEffect, useState } from 'react'
import { translate } from '@renderer/i18n'

export type DialogType = 'info' | 'error' | 'warning' | 'success'

export interface DialogDetails {
  type: DialogType
  title: string
  content: string
}

const GlobalDialogContent = React.lazy(() => import('./global-dialog-content'))

export const GlobalDialogModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [hasDialogContent, setHasDialogContent] = useState(false)
  const [details, setDetails] = useState<DialogDetails>({
    type: 'info',
    title: '',
    content: ''
  })

  useEffect(() => {
    const showDialog = (nextDetails: DialogDetails): void => {
      setDetails(nextDetails)
      setHasDialogContent(true)
      setIsOpen(true)
    }

    const handleCustom = (event: Event): void => {
      const customEvent = event as CustomEvent<Partial<DialogDetails>>
      const { type = 'error', title, content } = customEvent.detail || {}
      showDialog({
        type,
        title: title || translate(type === 'error' ? 'dialog.error' : 'dialog.info'),
        content: content || ''
      })
    }

    const handleGlobalError = (event: Event): void => {
      const detail = (event as CustomEvent<Partial<DialogDetails>>).detail
      showDialog({
        type: 'error',
        title: detail?.title || translate('dialog.error'),
        content: detail?.content || ''
      })
    }

    try {
      window.addEventListener('show-global-dialog', handleCustom)
      window.addEventListener('show-global-error', handleGlobalError)
    } catch (e) {
      console.error('Failed to register dialog listeners', e)
    }

    return (): void => {
      try {
        window.removeEventListener('show-global-dialog', handleCustom)
        window.removeEventListener('show-global-error', handleGlobalError)
      } catch {
        // ignore
      }
    }
  }, [])

  if (!hasDialogContent) {
    return null
  }

  return (
    <React.Suspense fallback={null}>
      <GlobalDialogContent isOpen={isOpen} details={details} onClose={() => setIsOpen(false)} />
    </React.Suspense>
  )
}
