import useSWR from 'swr'
import { checkMihomoLatestVersion } from '@renderer/utils/mihomo-ipc'

const CHECK_INTERVAL = 5 * 60 * 1000

export function useMihomoLatestVersion(core: string): string | null {
  const isAlpha = core === 'mihomo-alpha'
  const { data } = useSWR(
    ['mihomoLatestVersion', isAlpha],
    async ([, alpha]: [string, boolean]) => {
      if (document.hidden || !navigator.onLine) {
        throw new Error('Mihomo version check paused')
      }
      const latest = await checkMihomoLatestVersion(alpha)
      if (!latest) {
        throw new Error('Mihomo version check failed')
      }
      return latest
    },
    {
      refreshInterval: CHECK_INTERVAL,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      focusThrottleInterval: 5000,
      dedupingInterval: 5000,
      keepPreviousData: false,
      onErrorRetry: (_error, _key, _config, revalidate, options) => {
        const delay = Math.min(30_000 * 2 ** Math.min(options.retryCount - 1, 4), CHECK_INTERVAL)
        setTimeout(() => {
          if (!document.hidden && navigator.onLine) {
            revalidate(options)
          }
        }, delay)
      }
    }
  )
  return data ?? null
}
