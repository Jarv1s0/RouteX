import { useEffect, useState } from 'react'
import { isMihomoProcessPath } from '@renderer/utils/mihomo-process'
import { getIconDataURL } from '@renderer/utils/resource-ipc'

export function useProcessIcon(process?: string, processPath?: string) {
  const [processIconUrl, setProcessIconUrl] = useState('')
  const useMihomoIcon = isMihomoProcessPath(processPath) || isMihomoProcessPath(process)

  useEffect(() => {
    let disposed = false
    setProcessIconUrl('')

    if (!processPath || useMihomoIcon) {
      return () => {
        disposed = true
      }
    }

    void getIconDataURL(processPath)
      .then((iconUrl) => {
        if (!disposed) {
          setProcessIconUrl(iconUrl)
        }
      })
      .catch(() => {
        if (!disposed) {
          setProcessIconUrl('')
        }
      })

    return () => {
      disposed = true
    }
  }, [processPath, useMihomoIcon])

  return { processIconUrl, useMihomoIcon }
}
