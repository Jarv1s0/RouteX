import useSWR from 'swr'
import { checkMihomoLatestVersion } from '@renderer/utils/mihomo-ipc'
import { hasMihomoCoreUpdate } from '@renderer/utils/mihomo-version'

interface MihomoCoreUpdateStatus {
  latestVersion: string | null
  hasNewVersion: boolean
}

export function useMihomoCoreUpdateStatus(
  core: string,
  currentVersion?: string | null
): MihomoCoreUpdateStatus {
  const { data: latestVersion = null } = useSWR(
    ['mihomoLatestVersion', core],
    ([, targetCore]) => checkMihomoLatestVersion(targetCore === 'mihomo-alpha'),
    {
      shouldRetryOnError: false,
      revalidateOnFocus: false
    }
  )

  return {
    latestVersion,
    hasNewVersion: hasMihomoCoreUpdate(currentVersion, latestVersion, core)
  }
}
