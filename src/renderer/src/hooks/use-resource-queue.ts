import { useCallback, useEffect, useRef, useState } from 'react'
import { getAppName, getIconDataURL } from '@renderer/utils/ipc'
import { platform } from '@renderer/utils/init'
import { cropAndPadTransparent } from '@renderer/utils/image'

interface UseResourceQueueResult {
  iconMap: Record<string, string>
  appNameCache: Record<string, string>
  firstItemRefreshTrigger: number
  loadIcon: (path: string, isVisible?: boolean) => void
  loadAppName: (path: string) => void
}

export function useResourceQueue(
  displayIcon: boolean,
  displayAppName: boolean,
  findProcessMode: string,
  filteredConnectionsFirstPath: string | undefined
): UseResourceQueueResult {
  const [iconMap, setIconMap] = useState<Record<string, string>>({})
  const [appNameCache, setAppNameCache] = useState<Record<string, string>>({})
  const [firstItemRefreshTrigger, setFirstItemRefreshTrigger] = useState(0)

  const iconRequestQueue = useRef(new Set<string>())
  const processingIcons = useRef(new Set<string>())
  const processIconTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const appNameRequestQueue = useRef(new Set<string>())
  const processingAppNames = useRef(new Set<string>())
  const processAppNameTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const processAppNameQueue = useCallback(async () => {
    if (processingAppNames.current.size >= 3 || appNameRequestQueue.current.size === 0) return

    const pathsToProcess = Array.from(appNameRequestQueue.current).slice(0, 3)
    pathsToProcess.forEach((path) => appNameRequestQueue.current.delete(path))

    const promises = pathsToProcess.map(async (path) => {
      if (processingAppNames.current.has(path)) return
      processingAppNames.current.add(path)

      try {
        const appName = await getAppName(path)
        if (appName) {
          setAppNameCache((prev) => ({ ...prev, [path]: appName }))
        }
      } catch {
        // ignore
      } finally {
        processingAppNames.current.delete(path)
      }
    })

    await Promise.all(promises)

    if (appNameRequestQueue.current.size > 0) {
      processAppNameTimer.current = setTimeout(processAppNameQueue, 100)
    }
  }, [])

  const processIconQueue = useCallback(async () => {
    if (processingIcons.current.size >= 5 || iconRequestQueue.current.size === 0) return

    const pathsToProcess = Array.from(iconRequestQueue.current).slice(0, 5)
    pathsToProcess.forEach((path) => iconRequestQueue.current.delete(path))

    const promises = pathsToProcess.map(async (path) => {
      if (processingIcons.current.has(path)) return
      processingIcons.current.add(path)

      try {
        const rawBase64 = await getIconDataURL(path)
        if (!rawBase64) return

        const fullDataURL = rawBase64.startsWith('data:')
          ? rawBase64
          : `data:image/png;base64,${rawBase64}`

        let processedDataURL = fullDataURL
        if (platform !== 'darwin') {
          processedDataURL = await cropAndPadTransparent(fullDataURL)
        }

        try {
          localStorage.setItem(path, processedDataURL)
        } catch {
          // ignore
        }

        setIconMap((prev) => ({ ...prev, [path]: processedDataURL }))

        if (filteredConnectionsFirstPath === path) {
          setFirstItemRefreshTrigger((prev) => prev + 1)
        }
      } catch {
        // ignore
      } finally {
        processingIcons.current.delete(path)
      }
    })

    await Promise.all(promises)

    if (iconRequestQueue.current.size > 0) {
      processIconTimer.current = setTimeout(processIconQueue, 50)
    }
  }, [filteredConnectionsFirstPath])

  // Queue consumers
  useEffect(() => {
    if (!displayIcon || findProcessMode === 'off') {
        if (processIconTimer.current) clearTimeout(processIconTimer.current)
        return
    }
    
    // Start processing immediately if queue is not empty, otherwise ensure timer is cleared
    if (iconRequestQueue.current.size > 0) {
        if (processIconTimer.current) clearTimeout(processIconTimer.current)
        processIconTimer.current = setTimeout(processIconQueue, 10)
    }
    
    return () => {
        if (processIconTimer.current) clearTimeout(processIconTimer.current)
    }
  }, [displayIcon, findProcessMode, processIconQueue])


  useEffect(() => {
    if (!displayAppName) {
        if (processAppNameTimer.current) clearTimeout(processAppNameTimer.current)
        return
    }

    if (appNameRequestQueue.current.size > 0) {
        if (processAppNameTimer.current) clearTimeout(processAppNameTimer.current)
        processAppNameTimer.current = setTimeout(processAppNameQueue, 10)
    }

    return () => {
        if (processAppNameTimer.current) clearTimeout(processAppNameTimer.current)
    }
  }, [displayAppName, processAppNameQueue])


  const loadIcon = useCallback((path: string, isVisible: boolean = false): void => {
    if (iconMap[path] || processingIcons.current.has(path)) return

    const fromStorage = localStorage.getItem(path)
    if (fromStorage) {
      setIconMap((prev) => ({ ...prev, [path]: fromStorage }))
      if (isVisible && filteredConnectionsFirstPath === path) {
        setFirstItemRefreshTrigger((prev) => prev + 1)
      }
      return
    }

    iconRequestQueue.current.add(path)
    // Trigger consumer if not running? 
    // The consumer effects watch the queue? No, they watch deps. 
    // But adding to ref doesn't trigger re-render.
    // So we need to ensure the timer starts if it wasn't running.
    if (!processIconTimer.current && displayIcon && findProcessMode !== 'off') {
        processIconTimer.current = setTimeout(processIconQueue, 10)
    }
  }, [iconMap, filteredConnectionsFirstPath, displayIcon, findProcessMode, processIconQueue])

  const loadAppName = useCallback((path: string): void => {
    if (appNameCache[path] || processingAppNames.current.has(path)) return
    appNameRequestQueue.current.add(path)
    if (!processAppNameTimer.current && displayAppName) {
        processAppNameTimer.current = setTimeout(processAppNameQueue, 10)
    }
  }, [appNameCache, displayAppName, processAppNameQueue])

  return {
    iconMap,
    appNameCache,
    firstItemRefreshTrigger,
    loadIcon,
    loadAppName
  }
}
