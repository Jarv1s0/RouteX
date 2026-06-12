import { useCallback, useEffect, useRef, useState } from 'react'
import { getAppName, getIconDataURLs } from '@renderer/utils/resource-ipc'

const VISIBLE_ICON_BATCH_SIZE = 12
const PRELOAD_ICON_BATCH_SIZE = 2
const RESOURCE_FAILURE_CACHE_MS = 5 * 60 * 1000
const SHARED_ICON_CACHE_LIMIT = 256
const SHARED_APP_NAME_CACHE_LIMIT = 1024
const RESOURCE_FAILURE_CACHE_LIMIT = 2048
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
  cache.delete(path)
  cache.set(path, Date.now())
  trimCache(cache, RESOURCE_FAILURE_CACHE_LIMIT)
}

function forgetResourceFailure(cache: Map<string, number>, path: string): void {
  cache.delete(path)
}

function trimCache<K, V>(cache: Map<K, V>, limit: number): void {
  while (cache.size > limit) {
    const oldestKey = cache.keys().next().value
    if (oldestKey === undefined) break
    cache.delete(oldestKey)
  }
}

function writeSharedCache(
  cache: Map<string, string>,
  key: string,
  value: string,
  limit: number
): void {
  cache.delete(key)
  cache.set(key, value)
  trimCache(cache, limit)
}

function readSharedCache(cache: Map<string, string>, key: string, limit: number): string | null {
  const value = cache.get(key)
  if (!value) return null

  writeSharedCache(cache, key, value, limit)
  return value
}

function clearQueuedTimer(timerRef: { current: ReturnType<typeof setTimeout> | null }): void {
  if (!timerRef.current) return

  clearTimeout(timerRef.current)
  timerRef.current = null
}

function setQueuedTimer(
  timerRef: { current: ReturnType<typeof setTimeout> | null },
  delay: number,
  callback: () => void | Promise<void>
): void {
  timerRef.current = setTimeout(() => {
    timerRef.current = null
    void callback()
  }, delay)
}

function mergeCappedRecord(
  previous: Record<string, string>,
  next: Record<string, string>,
  limit: number
): Record<string, string> {
  const entries = new Map(Object.entries(previous))

  Object.entries(next).forEach(([key, value]) => {
    entries.delete(key)
    entries.set(key, value)
  })

  return Object.fromEntries(Array.from(entries).slice(-limit))
}

function readCachedIcon(path: string): string | null {
  return readSharedCache(sharedIconMemoryCache, path, SHARED_ICON_CACHE_LIMIT)
}

function writeCachedIcon(path: string, dataUrl: string): void {
  writeSharedCache(sharedIconMemoryCache, path, dataUrl, SHARED_ICON_CACHE_LIMIT)
}

function hasQueuedIconRequests(
  visibleQueue: Set<string>,
  preloadQueue: Set<string>
): boolean {
  return visibleQueue.size > 0 || preloadQueue.size > 0
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
          writeSharedCache(sharedAppNameMemoryCache, path, appName, SHARED_APP_NAME_CACHE_LIMIT)
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
      setAppNameCache((prev) => mergeCappedRecord(prev, nextAppNames, SHARED_APP_NAME_CACHE_LIMIT))
    }

    if (appNameRequestQueue.current.size > 0) {
      setQueuedTimer(processAppNameTimer, 100, processAppNameQueue)
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
      setIconMap((prev) => mergeCappedRecord(prev, nextIcons, SHARED_ICON_CACHE_LIMIT))
      if (shouldRefreshFirstItem) {
        setFirstItemRefreshTrigger((prev) => prev + 1)
      }
    }

    if (hasQueuedIconRequests(visibleIconRequestQueue.current, preloadIconRequestQueue.current)) {
      setQueuedTimer(
        processIconTimer,
        visibleIconRequestQueue.current.size > 0 ? 20 : 60,
        processIconQueue
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
      clearQueuedTimer(processIconTimer)
      clearQueuedTimer(processAppNameTimer)
    }
  }, [])

  useEffect(() => {
    if (!displayIcon || findProcessMode === 'off') {
      clearQueuedTimer(processIconTimer)
      visibleIconRequestQueue.current.clear()
      preloadIconRequestQueue.current.clear()
      setIconMap({})
      return
    }

    // Start processing immediately if queue is not empty, otherwise ensure timer is cleared
    if (hasQueuedIconRequests(visibleIconRequestQueue.current, preloadIconRequestQueue.current)) {
      clearQueuedTimer(processIconTimer)
      setQueuedTimer(processIconTimer, 10, processIconQueue)
    }

    return () => {
      clearQueuedTimer(processIconTimer)
    }
  }, [displayIcon, findProcessMode, processIconQueue])

  useEffect(() => {
    if (!displayAppName) {
      clearQueuedTimer(processAppNameTimer)
      appNameRequestQueue.current.clear()
      setAppNameCache({})
      return
    }

    if (appNameRequestQueue.current.size > 0) {
      clearQueuedTimer(processAppNameTimer)
      setQueuedTimer(processAppNameTimer, 10, processAppNameQueue)
    }

    return () => {
      clearQueuedTimer(processAppNameTimer)
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
        setIconMap((prev) =>
          prev[path]
            ? prev
            : mergeCappedRecord(prev, { [path]: fromStorage }, SHARED_ICON_CACHE_LIMIT)
        )
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

      // Queue refs do not trigger effects, so start the consumer here when needed.
      if (
        !processIconTimer.current &&
        processingIcons.current.size === 0 &&
        displayIcon &&
        findProcessMode !== 'off'
      ) {
        setQueuedTimer(processIconTimer, 10, processIconQueue)
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

      const fromMemory = readSharedCache(
        sharedAppNameMemoryCache,
        path,
        SHARED_APP_NAME_CACHE_LIMIT
      )
      if (fromMemory) {
        forgetResourceFailure(sharedAppNameFailureCache, path)
        setAppNameCache((prev) =>
          prev[path]
            ? prev
            : mergeCappedRecord(prev, { [path]: fromMemory }, SHARED_APP_NAME_CACHE_LIMIT)
        )
        return
      }

      appNameRequestQueue.current.add(path)
      if (!processAppNameTimer.current && processingAppNames.current.size === 0 && displayAppName) {
        setQueuedTimer(processAppNameTimer, 10, processAppNameQueue)
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
