import { useCallback, useEffect, useRef, useState } from 'react'
import { getAppName, getIconDataURLs } from '@renderer/utils/resource-ipc'

const ICON_CACHE_PREFIX = 'routex:icon:v2:'
const ICON_CACHE_INDEX_KEY = 'routex:icon:index'
const MAX_ICON_CACHE_ENTRIES = 120
const VISIBLE_ICON_BATCH_SIZE = 8
const PRELOAD_ICON_BATCH_SIZE = 4
const sharedIconMemoryCache = new Map<string, string>()
const sharedAppNameMemoryCache = new Map<string, string>()

interface UseResourceQueueResult {
  iconMap: Record<string, string>
  appNameCache: Record<string, string>
  firstItemRefreshTrigger: number
  loadIcon: (path: string, isVisible?: boolean) => void
  loadAppName: (path: string) => void
}

function shouldPersistIconCache(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  } catch {
    return false
  }
}

function getIconCacheKey(path: string): string {
  return `${ICON_CACHE_PREFIX}${path}`
}

function readIconCacheIndex(): string[] {
  try {
    const raw = localStorage.getItem(ICON_CACHE_INDEX_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

function writeIconCacheIndex(index: string[]): void {
  try {
    localStorage.setItem(ICON_CACHE_INDEX_KEY, JSON.stringify(index))
  } catch {
    // ignore cache index write failure
  }
}

function evictIconCacheEntries(index: string[], maxEntries: number): string[] {
  const nextIndex = [...index]

  while (nextIndex.length > maxEntries) {
    const evictedPath = nextIndex.pop()
    if (evictedPath) {
      localStorage.removeItem(getIconCacheKey(evictedPath))
    }
  }

  return nextIndex
}

function rememberCachedIcon(path: string): void {
  if (!shouldPersistIconCache()) {
    return
  }

  const nextIndex = [path, ...readIconCacheIndex().filter((cachedPath) => cachedPath !== path)]
  writeIconCacheIndex(evictIconCacheEntries(nextIndex, MAX_ICON_CACHE_ENTRIES))
}

function readCachedIcon(path: string): string | null {
  const fromMemory = sharedIconMemoryCache.get(path)
  if (fromMemory) {
    return fromMemory
  }

  if (!shouldPersistIconCache()) {
    return null
  }

  const cacheKey = getIconCacheKey(path)
  const cachedIcon = localStorage.getItem(cacheKey)

  if (cachedIcon) {
    sharedIconMemoryCache.set(path, cachedIcon)
    rememberCachedIcon(path)
    return cachedIcon
  }

  const legacyCachedIcon = localStorage.getItem(path)
  if (!legacyCachedIcon) {
    return null
  }

  try {
    localStorage.removeItem(path)
    writeCachedIcon(path, legacyCachedIcon)
  } catch {
    // ignore migration failure
  }

  sharedIconMemoryCache.set(path, legacyCachedIcon)
  return legacyCachedIcon
}

function writeCachedIcon(path: string, dataUrl: string): void {
  sharedIconMemoryCache.set(path, dataUrl)

  if (!shouldPersistIconCache()) {
    return
  }

  const cacheKey = getIconCacheKey(path)

  try {
    localStorage.setItem(cacheKey, dataUrl)
    rememberCachedIcon(path)
    return
  } catch {
    const evictedIndex = evictIconCacheEntries(
      readIconCacheIndex(),
      Math.max(0, MAX_ICON_CACHE_ENTRIES - 10)
    )

    try {
      writeIconCacheIndex(evictedIndex)
      localStorage.setItem(cacheKey, dataUrl)
      rememberCachedIcon(path)
    } catch {
      // ignore cache write failure
    }
  }
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
          sharedAppNameMemoryCache.set(path, appName)
          nextAppNames[path] = appName
        }
      } catch {
        // ignore
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
        if (!rawBase64) return

        const fullDataURL = rawBase64.startsWith('data:')
          ? rawBase64
          : `data:image/png;base64,${rawBase64}`

        try {
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
      // ignore
    } finally {
      pathsToProcess.forEach((path) => processingIcons.current.delete(path))
    }

    if (!disposedRef.current && Object.keys(nextIcons).length > 0) {
      setIconMap((prev) => ({ ...prev, ...nextIcons }))
      if (shouldRefreshFirstItem) {
        setFirstItemRefreshTrigger((prev) => prev + 1)
      }
    }

    if (
      visibleIconRequestQueue.current.size > 0 ||
      preloadIconRequestQueue.current.size > 0
    ) {
      processIconTimer.current = setTimeout(() => {
        processIconTimer.current = null
        void processIconQueue()
      }, visibleIconRequestQueue.current.size > 0 ? 20 : 60)
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
    if (
      visibleIconRequestQueue.current.size > 0 ||
      preloadIconRequestQueue.current.size > 0
    ) {
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
      if (iconMap[path] || processingIcons.current.has(path)) return

      const fromStorage = readCachedIcon(path)
      if (fromStorage) {
        setIconMap((prev) => ({ ...prev, [path]: fromStorage }))
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
    [iconMap, filteredConnectionsFirstPath, displayIcon, findProcessMode, processIconQueue]
  )

  const loadAppName = useCallback(
    (path: string): void => {
      if (appNameCache[path] || processingAppNames.current.has(path)) return

      const fromMemory = sharedAppNameMemoryCache.get(path)
      if (fromMemory) {
        setAppNameCache((prev) => ({ ...prev, [path]: fromMemory }))
        return
      }

      appNameRequestQueue.current.add(path)
      if (
        !processAppNameTimer.current &&
        processingAppNames.current.size === 0 &&
        displayAppName
      ) {
        processAppNameTimer.current = setTimeout(() => {
          processAppNameTimer.current = null
          void processAppNameQueue()
        }, 10)
      }
    },
    [appNameCache, displayAppName, processAppNameQueue]
  )

  return {
    iconMap,
    appNameCache,
    firstItemRefreshTrigger,
    loadIcon,
    loadAppName
  }
}
