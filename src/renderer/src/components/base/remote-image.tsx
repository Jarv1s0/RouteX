import React, { useEffect, useMemo, useState } from 'react'
import { getImageDataURL } from '@renderer/utils/resource-ipc'
const REMOTE_IMAGE_CACHE_PREFIX = 'routex:remote-image:'
const memoryCache = new Map<string, string>()
const pendingRequests = new Map<string, Promise<string>>()

const DEFAULT_FALLBACK_SRC =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>'

function getCacheKey(url: string): string {
  return `${REMOTE_IMAGE_CACHE_PREFIX}${url}`
}

function readCachedRemoteImage(url: string): string | null {
  const cached = memoryCache.get(url)
  if (cached) return cached

  try {
    const fromStorage = localStorage.getItem(getCacheKey(url))
    if (!fromStorage) return null
    memoryCache.set(url, fromStorage)
    return fromStorage
  } catch {
    return null
  }
}

function writeCachedRemoteImage(url: string, dataUrl: string): void {
  memoryCache.set(url, dataUrl)
  try {
    localStorage.setItem(getCacheKey(url), dataUrl)
  } catch {
    // ignore cache write failure
  }
}

async function resolveRemoteImage(url: string): Promise<string> {
  const cached = readCachedRemoteImage(url)
  if (cached) return cached

  const pending = pendingRequests.get(url)
  if (pending) return pending

  const request = getImageDataURL(url)
    .then((dataUrl) => {
      writeCachedRemoteImage(url, dataUrl)
      return dataUrl
    })
    .finally(() => {
      pendingRequests.delete(url)
    })

  pendingRequests.set(url, request)
  return request
}

interface RemoteImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string
  fallbackSrc?: string
}

export const RemoteImage: React.FC<RemoteImageProps> = ({
  src,
  fallbackSrc = DEFAULT_FALLBACK_SRC,
  alt = '',
  ...props
}) => {
  const [resolvedSrc, setResolvedSrc] = useState<string>(fallbackSrc)
  const normalizedSrc = useMemo(() => src?.trim() || '', [src])

  useEffect(() => {
    let cancelled = false

    if (!normalizedSrc) {
      setResolvedSrc(fallbackSrc)
      return
    }

    if (!/^https?:\/\//i.test(normalizedSrc)) {
      setResolvedSrc(normalizedSrc)
      return
    }

    const cached = readCachedRemoteImage(normalizedSrc)
    if (cached) {
      setResolvedSrc(cached)
      return
    }

    setResolvedSrc(fallbackSrc)

    void resolveRemoteImage(normalizedSrc)
      .then((dataUrl) => {
        if (!cancelled) {
          setResolvedSrc(dataUrl)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedSrc(fallbackSrc)
        }
      })

    return () => {
      cancelled = true
    }
  }, [fallbackSrc, normalizedSrc])

  return <img {...props} src={resolvedSrc} alt={alt} />
}
