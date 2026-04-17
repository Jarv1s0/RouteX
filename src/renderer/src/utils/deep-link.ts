import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link'
import { toast } from 'sonner'
import { addOverrideItem } from './override-ipc'
import { addProfileItem } from './profile-ipc'
import { showMainWindow } from './window-ipc'

interface InstallConfirmPayload {
  requestId: string
  url: string
  name?: string | null
}

interface InstallConfirmResultPayload {
  requestId: string
  confirmed: boolean
}

const DEEP_LINK_SCHEMES = ['clash://', 'mihomo://', 'routex://'] as const
const PROFILE_INSTALL_EVENT = 'routex:show-profile-install-confirm'
const PROFILE_INSTALL_RESULT_EVENT = 'routex:profile-install-confirm-result'
const OVERRIDE_INSTALL_EVENT = 'routex:show-override-install-confirm'
const OVERRIDE_INSTALL_RESULT_EVENT = 'routex:override-install-confirm-result'
const RECENT_DEEP_LINK_WINDOW_MS = 5000

const recentDeepLinkTimestamps = new Map<string, number>()
let deepLinkInitialized = false

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
}

function isSupportedDeepLink(url: string): boolean {
  return DEEP_LINK_SCHEMES.some((scheme) => url.startsWith(scheme))
}

function shouldSkipRecentDeepLink(url: string): boolean {
  const now = Date.now()

  for (const [key, timestamp] of recentDeepLinkTimestamps) {
    if (now - timestamp > RECENT_DEEP_LINK_WINDOW_MS) {
      recentDeepLinkTimestamps.delete(key)
    }
  }

  const previous = recentDeepLinkTimestamps.get(url)
  if (previous && now - previous <= RECENT_DEEP_LINK_WINDOW_MS) {
    return true
  }

  recentDeepLinkTimestamps.set(url, now)
  return false
}

function inferNameFromUrl(url: string, fallback?: string | null): string | undefined {
  const trimmedFallback = fallback?.trim()
  if (trimmedFallback) {
    return trimmedFallback
  }

  try {
    const filename = new URL(url).pathname.split('/').pop()
    return filename ? decodeURIComponent(filename) : undefined
  } catch {
    return trimmedFallback || undefined
  }
}

function waitForCustomConfirm(
  requestEventName: string,
  resultEventName: string,
  payload: Omit<InstallConfirmPayload, 'requestId'>
): Promise<boolean> {
  const requestId = createRequestId()

  return new Promise((resolve) => {
    const handleResult = (event: Event): void => {
      const detail = (event as CustomEvent<InstallConfirmResultPayload>).detail
      if (!detail || detail.requestId !== requestId) {
        return
      }

      window.removeEventListener(resultEventName, handleResult)
      resolve(Boolean(detail.confirmed))
    }

    window.addEventListener(resultEventName, handleResult)
    window.dispatchEvent(
      new CustomEvent<InstallConfirmPayload>(requestEventName, {
        detail: {
          requestId,
          ...payload
        }
      })
    )
  })
}

function parseInstallTarget(url: string): { targetUrl?: string; targetName?: string | null } {
  const parsed = new URL(url)
  return {
    targetUrl: parsed.searchParams.get('url') || undefined,
    targetName: parsed.searchParams.get('name')
  }
}

async function handleProfileInstall(url: string): Promise<void> {
  const { targetUrl, targetName } = parseInstallTarget(url)
  if (!targetUrl) {
    throw new Error('缺少参数 url')
  }

  const confirmed = await waitForCustomConfirm(PROFILE_INSTALL_EVENT, PROFILE_INSTALL_RESULT_EVENT, {
    url: targetUrl,
    name: inferNameFromUrl(targetUrl, targetName)
  })
  if (!confirmed) {
    return
  }

  await addProfileItem({
    type: 'remote',
    name: targetName ?? undefined,
    url: targetUrl
  })

  toast.success('订阅导入成功')
}

async function handleOverrideInstall(url: string): Promise<void> {
  const { targetUrl, targetName } = parseInstallTarget(url)
  if (!targetUrl) {
    throw new Error('缺少参数 url')
  }

  const inferredName = inferNameFromUrl(targetUrl, targetName)
  const confirmed = await waitForCustomConfirm(OVERRIDE_INSTALL_EVENT, OVERRIDE_INSTALL_RESULT_EVENT, {
    url: targetUrl,
    name: inferredName
  })
  if (!confirmed) {
    return
  }

  const overrideUrlObject = new URL(targetUrl)
  await addOverrideItem({
    type: 'remote',
    name: inferredName,
    url: targetUrl,
    ext: overrideUrlObject.pathname.endsWith('.js') ? 'js' : 'yaml'
  })

  toast.success('覆写导入成功')
}

async function handleDeepLink(url: string): Promise<void> {
  if (!isSupportedDeepLink(url) || shouldSkipRecentDeepLink(url)) {
    return
  }

  await showMainWindow()

  const parsed = new URL(url)
  switch (parsed.host) {
    case 'install-config':
      await handleProfileInstall(url)
      return
    case 'install-override':
      await handleOverrideInstall(url)
      return
    default:
      return
  }
}

async function processDeepLinks(urls: string[]): Promise<void> {
  for (const url of urls) {
    try {
      await handleDeepLink(url)
    } catch (error) {
      toast.error('处理链接失败', {
        description: error instanceof Error ? error.message : String(error)
      })
    }
  }
}

export async function initDeepLinkIntegration(): Promise<void> {
  if (__ROUTEX_HOST__ !== 'tauri' || deepLinkInitialized) {
    return
  }

  deepLinkInitialized = true

  const startupUrls = await getCurrent().catch(() => [])
  if (startupUrls.length > 0) {
    await processDeepLinks(startupUrls)
  }

  await onOpenUrl((urls) => {
    void processDeepLinks(urls)
  })
}
