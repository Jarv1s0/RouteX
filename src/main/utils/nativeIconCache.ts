import { nativeImage, type NativeImage } from 'electron'

const nativeIconCache = new Map<string, NativeImage>()

export function getCachedNativeIcon(iconPath: string, width?: number, height?: number): NativeImage {
  const cacheKey = `${iconPath}|${width || 0}x${height || 0}`
  const cached = nativeIconCache.get(cacheKey)
  if (cached && !cached.isEmpty()) {
    return cached
  }

  const baseIcon = nativeImage.createFromPath(iconPath)
  const icon =
    width || height
      ? baseIcon.resize({
          ...(width ? { width } : {}),
          ...(height ? { height } : {})
        })
      : baseIcon

  nativeIconCache.set(cacheKey, icon)
  return icon
}
