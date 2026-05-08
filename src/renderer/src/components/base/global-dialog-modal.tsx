import React, { useEffect, useState } from 'react'

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
    const handleCustom = (event: Event): void => {
      const customEvent = event as CustomEvent<Partial<DialogDetails>>
      const { type = 'error', title, content } = customEvent.detail || {}
      setDetails({
        type,
        title: title || (type === 'error' ? '错误' : '提示'),
        content: content || ''
      })
      setHasDialogContent(true)
      setIsOpen(true)
    }

    const handleGlobalError = (event: Event): void => {
      const detail = (event as CustomEvent<Partial<DialogDetails>>).detail
      setDetails({
        type: 'error',
        title: detail?.title || '错误',
        content: detail?.content || ''
      })
      setHasDialogContent(true)
      setIsOpen(true)
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
