import { useCallback, useEffect, useRef, useState } from 'react'
import { getAppName, getIconDataURLs } from '@renderer/utils/resource-ipc'

const VISIBLE_ICON_BATCH_SIZE = 12
const PRELOAD_ICON_BATCH_SIZE = 2
const RESOURCE_FAILURE_CACHE_MS = 5 * 60 * 1000
const sharedIconMemoryCache = new Map<string, string>()
const sharedAppNameMemoryCache = new Map<string, string>()
const sharedIconFailureCache = new Map<string, number>()
const sharedAppNameFailureCache = new Map<string, number>()

interface UseResourceQueueResult {
  iconMap: Record<string, string>
  appNameCache: Record<string, string>
  firstItemRefreshTrigger: number
  loadIcon: (path: string, isVisible?: boolean) => void
  loadAppName: (path: string) => void
}

function hasRecentResourceFailure(cache: Map<string, number>, path: string): boolean {
  const failedAt = cache.get(path)
  if (!failedAt) {
    return false
  }

  if (Date.now() - failedAt < RESOURCE_FAILURE_CACHE_MS) {
    return true
  }

  cache.delete(path)
  return false
}

function rememberResourceFailure(cache: Map<string, number>, path: string): void {
  cache.set(path, Date.now())
}

function forgetResourceFailure(cache: Map<string, number>, path: string): void {
  cache.delete(path)
}

function readCachedIcon(path: string): string | null {
  const fromMemory = sharedIconMemoryCache.get(path)
  if (fromMemory) {
    return fromMemory
  }

  return null
}

function writeCachedIcon(path: string, dataUrl: string): void {
  sharedIconMemoryCache.set(path, dataUrl)
}

export function useResourceQueue(
  displayIcon: boolean,
  displayAppName: boolean,
  findProcessMode: string,
  filteredConnectionsFirstPath: string | undefined
): UseResourceQueueResult {
  const [iconMap, setIconMap] = useState<Record<string, string>>(() =>
    Object.fromEntries(sharedIconMemoryCache)
  )
  const [appNameCache, setAppNameCache] = useState<Record<string, string>>(() =>
    Object.fromEntries(sharedAppNameMemoryCache)
  )
  const [firstItemRefreshTrigger, setFirstItemRefreshTrigger] = useState(0)

  const visibleIconRequestQueue = useRef(new Set<string>())
  const preloadIconRequestQueue = useRef(new Set<string>())
  const processingIcons = useRef(new Set<string>())
  const processIconTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const disposedRef = useRef(false)

  const appNameRequestQueue = useRef(new Set<string>())
  const processingAppNames = useRef(new Set<string>())
  const processAppNameTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const processAppNameQueue = useCallback(async () => {
    if (processingAppNames.current.size >= 3 || appNameRequestQueue.current.size === 0) return

    const pathsToProcess = Array.from(appNameRequestQueue.current).slice(0, 3)
    pathsToProcess.forEach((path) => appNameRequestQueue.current.delete(path))
    const nextAppNames: Record<string, string> = {}

    const promises = pathsToProcess.map(async (path) => {
      if (processingAppNames.current.has(path)) return
      processingAppNames.current.add(path)

      try {
        const appName = await getAppName(path)
        if (appName) {
          forgetResourceFailure(sharedAppNameFailureCache, path)
          sharedAppNameMemoryCache.set(path, appName)
          nextAppNames[path] = appName
        } else {
          rememberResourceFailure(sharedAppNameFailureCache, path)
        }
      } catch {
        rememberResourceFailure(sharedAppNameFailureCache, path)
      } finally {
        processingAppNames.current.delete(path)
      }
    })

    await Promise.all(promises)

    if (!disposedRef.current && Object.keys(nextAppNames).length > 0) {
      setAppNameCache((prev) => ({ ...prev, ...nextAppNames }))
    }

    if (appNameRequestQueue.current.size > 0) {
      processAppNameTimer.current = setTimeout(() => {
        processAppNameTimer.current = null
        void processAppNameQueue()
      }, 100)
    }
  }, [])

  const processIconQueue = useCallback(async () => {
    if (processingIcons.current.size > 0) return

    const activeQueue =
      visibleIconRequestQueue.current.size > 0
        ? visibleIconRequestQueue.current
        : preloadIconRequestQueue.current.size > 0
          ? preloadIconRequestQueue.current
          : null

    if (!activeQueue) return

    const batchSize =
      activeQueue === visibleIconRequestQueue.current
        ? VISIBLE_ICON_BATCH_SIZE
        : PRELOAD_ICON_BATCH_SIZE
    const pathsToProcess = Array.from(activeQueue).slice(0, batchSize)
    pathsToProcess.forEach((path) => activeQueue.delete(path))
    const nextIcons: Record<string, string> = {}
    let shouldRefreshFirstItem = false

    pathsToProcess.forEach((path) => processingIcons.current.add(path))

    try {
      const batchedIcons = await getIconDataURLs(pathsToProcess)
      if (disposedRef.current) return

      pathsToProcess.forEach((path) => {
        const rawBase64 = batchedIcons[path]
        if (!rawBase64) {
          rememberResourceFailure(sharedIconFailureCache, path)
          return
        }

        const fullDataURL = rawBase64.startsWith('data:')
          ? rawBase64
          : `data:image/png;base64,${rawBase64}`

        try {
          forgetResourceFailure(sharedIconFailureCache, path)
          writeCachedIcon(path, fullDataURL)
        } catch {
          // ignore
        }

        nextIcons[path] = fullDataURL

        if (filteredConnectionsFirstPath === path) {
          shouldRefreshFirstItem = true
        }
      })
    } catch {
      pathsToProcess.forEach((path) => {
        rememberResourceFailure(sharedIconFailureCache, path)
      })
    } finally {
      pathsToProcess.forEach((path) => processingIcons.current.delete(path))
    }

    if (!disposedRef.current && Object.keys(nextIcons).length > 0) {
      setIconMap((prev) => ({ ...prev, ...nextIcons }))
      if (shouldRefreshFirstItem) {
        setFirstItemRefreshTrigger((prev) => prev + 1)
      }
    }

    if (visibleIconRequestQueue.current.size > 0 || preloadIconRequestQueue.current.size > 0) {
      processIconTimer.current = setTimeout(
        () => {
          processIconTimer.current = null
          void processIconQueue()
        },
        visibleIconRequestQueue.current.size > 0 ? 20 : 60
      )
    }
  }, [filteredConnectionsFirstPath])

  // Queue consumers
  useEffect(() => {
    disposedRef.current = false

    return () => {
      disposedRef.current = true
      visibleIconRequestQueue.current.clear()
      preloadIconRequestQueue.current.clear()
      appNameRequestQueue.current.clear()
      processingIcons.current.clear()
      processingAppNames.current.clear()
      if (processIconTimer.current) {
        clearTimeout(processIconTimer.current)
        processIconTimer.current = null
      }
      if (processAppNameTimer.current) {
        clearTimeout(processAppNameTimer.current)
        processAppNameTimer.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!displayIcon || findProcessMode === 'off') {
      if (processIconTimer.current) clearTimeout(processIconTimer.current)
      return
    }

    // Start processing immediately if queue is not empty, otherwise ensure timer is cleared
    if (visibleIconRequestQueue.current.size > 0 || preloadIconRequestQueue.current.size > 0) {
      if (processIconTimer.current) clearTimeout(processIconTimer.current)
      processIconTimer.current = setTimeout(() => {
        processIconTimer.current = null
        void processIconQueue()
      }, 10)
    }

    return () => {
      if (processIconTimer.current) {
        clearTimeout(processIconTimer.current)
        processIconTimer.current = null
      }
    }
  }, [displayIcon, findProcessMode, processIconQueue])

  useEffect(() => {
    if (!displayAppName) {
      if (processAppNameTimer.current) clearTimeout(processAppNameTimer.current)
      return
    }

    if (appNameRequestQueue.current.size > 0) {
      if (processAppNameTimer.current) clearTimeout(processAppNameTimer.current)
      processAppNameTimer.current = setTimeout(() => {
        processAppNameTimer.current = null
        void processAppNameQueue()
      }, 10)
    }

    return () => {
      if (processAppNameTimer.current) {
        clearTimeout(processAppNameTimer.current)
        processAppNameTimer.current = null
      }
    }
  }, [displayAppName, processAppNameQueue])

  const loadIcon = useCallback(
    (path: string, isVisible: boolean = false): void => {
      if (
        processingIcons.current.has(path) ||
        hasRecentResourceFailure(sharedIconFailureCache, path)
      )
        return

      const fromStorage = readCachedIcon(path)
      if (fromStorage) {
        forgetResourceFailure(sharedIconFailureCache, path)
        setIconMap((prev) => (prev[path] ? prev : { ...prev, [path]: fromStorage }))
        if (isVisible && filteredConnectionsFirstPath === path) {
          setFirstItemRefreshTrigger((prev) => prev + 1)
        }
        return
      }

      if (isVisible) {
        preloadIconRequestQueue.current.delete(path)
        visibleIconRequestQueue.current.add(path)
      } else if (!visibleIconRequestQueue.current.has(path)) {
        preloadIconRequestQueue.current.add(path)
      }

      // Trigger consumer if not running?
      // The consumer effects watch the queue? No, they watch deps.
      // But adding to ref doesn't trigger re-render.
      // So we need to ensure the timer starts if it wasn't running.
      if (
        !processIconTimer.current &&
        processingIcons.current.size === 0 &&
        displayIcon &&
        findProcessMode !== 'off'
      ) {
        processIconTimer.current = setTimeout(() => {
          processIconTimer.current = null
          void processIconQueue()
        }, 10)
      }
    },
    [filteredConnectionsFirstPath, displayIcon, findProcessMode, processIconQueue]
  )

  const loadAppName = useCallback(
    (path: string): void => {
      if (
        processingAppNames.current.has(path) ||
        hasRecentResourceFailure(sharedAppNameFailureCache, path)
      )
        return

      const fromMemory = sharedAppNameMemoryCache.get(path)
      if (fromMemory) {
        forgetResourceFailure(sharedAppNameFailureCache, path)
        setAppNameCache((prev) => (prev[path] ? prev : { ...prev, [path]: fromMemory }))
        return
      }

      appNameRequestQueue.current.add(path)
      if (!processAppNameTimer.current && processingAppNames.current.size === 0 && displayAppName) {
        processAppNameTimer.current = setTimeout(() => {
          processAppNameTimer.current = null
          void processAppNameQueue()
        }, 10)
      }
    },
    [displayAppName, processAppNameQueue]
  )

  return {
    iconMap,
    appNameCache,
    firstItemRefreshTrigger,
    loadIcon,
    loadAppName
  }
}
