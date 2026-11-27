import { useCallback, useRef } from 'react'
import { notifyError } from '@renderer/utils/notify'

export function useQueuedSettingSave<T>(saved: T, equal: (a: T, b: T) => boolean = Object.is) {
  const queue = useRef<{ completion: Promise<void>; value: T } | null>(null)
  const savedRef = useRef(saved)
  savedRef.current = saved

  const isSaving = useCallback(() => queue.current !== null, [])
  const save = useCallback(
    (value: T, persist: (value: T) => Promise<void>) => {
      const previous = queue.current
      if (equal(value, previous ? previous.value : savedRef.current)) return

      const write = async (): Promise<void> => {
        try {
          await persist(value)
        } catch (error) {
          notifyError(error)
        }
      }
      const completion = (previous ? previous.completion.then(write) : write()).finally(() => {
        if (queue.current?.completion === completion) queue.current = null
      })
      queue.current = { completion, value }
    },
    [equal]
  )

  return [save, isSaving] as const
}
