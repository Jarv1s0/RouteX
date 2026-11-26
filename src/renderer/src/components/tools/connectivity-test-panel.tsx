import React, { useState, useRef, useCallback } from 'react'
import { Card, CardBody, Button, Input, Chip } from '@heroui/react'
import {
  IoWifi,
  IoRefresh,
  IoCheckmarkCircle,
  IoCloseCircle,
  IoAdd,
  IoClose,
  IoGlobe,
  IoPlayCircle
} from 'react-icons/io5'
import { RemoteImage } from '@renderer/components/base/remote-image'
import { testConnectivity, checkStreamingUnlock } from '@renderer/utils/tools-ipc'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { useI18n } from '@renderer/i18n'

interface CombinedTestTarget {
  id: string
  name: string
  url?: string
  icon?: string
  type: 'connectivity' | 'streaming'
  custom?: boolean
  status: 'idle' | 'queued' | 'testing' | 'success' | 'locked' | 'unlocked' | 'error'
  latency: number
  region?: string
  error?: string
}

interface StoredCustomTarget {
  id: string
  name: string
  url: string
}

const CUSTOM_TARGETS_STORAGE_KEY = 'routex:tools:customTargets'
const TEST_ALL_CONCURRENCY = 4

const defaultTargets = [
  {
    name: 'Google',
    url: 'https://www.google.com/generate_204',
    icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Google_Search.png'
  },
  {
    name: 'GitHub',
    url: 'https://github.com',
    icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/GitHub.png'
  },
  {
    name: 'YouTube',
    url: 'https://www.youtube.com',
    icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/YouTube.png'
  },
  {
    name: 'Cloudflare',
    url: 'https://1.1.1.1/cdn-cgi/trace',
    icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Cloudflare.png'
  },
  {
    name: 'Twitter',
    url: 'https://twitter.com',
    icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Twitter.png'
  },
  { name: 'Baidu', url: 'https://www.baidu.com', icon: 'https://www.baidu.com/favicon.ico' }
]

const defaultStreamingServices = [
  {
    key: 'chatgpt',
    name: 'ChatGPT',
    icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/ChatGPT.png'
  },
  {
    key: 'gemini',
    name: 'Gemini',
    icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Google.png'
  },
  {
    key: 'netflix',
    name: 'Netflix',
    icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Netflix.png'
  },
  {
    key: 'youtube',
    name: 'YouTube',
    icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/YouTube.png'
  },
  {
    key: 'spotify',
    name: 'Spotify',
    icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Spotify.png'
  },
  {
    key: 'tiktok',
    name: 'TikTok',
    icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/TikTok.png'
  }
]

function loadCustomTargets(): StoredCustomTarget[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TARGETS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is StoredCustomTarget =>
        Boolean(item?.id) && Boolean(item?.name) && Boolean(item?.url)
    )
  } catch {
    return []
  }
}

function saveCustomTargets(targets: StoredCustomTarget[]): void {
  try {
    localStorage.setItem(CUSTOM_TARGETS_STORAGE_KEY, JSON.stringify(targets))
  } catch {
    // ignore storage errors
  }
}

function buildInitialTargets(): CombinedTestTarget[] {
  const customTargets = loadCustomTargets().map(
    (item): CombinedTestTarget => ({
      id: item.id,
      name: item.name,
      url: item.url,
      type: 'connectivity',
      custom: true,
      status: 'idle',
      latency: -1
    })
  )

  return [
    ...defaultTargets.map(
      (t): CombinedTestTarget => ({
        id: `conn:${t.name}`,
        ...t,
        type: 'connectivity',
        status: 'idle',
        latency: -1
      })
    ),
    ...customTargets,
    ...defaultStreamingServices.map(
      (s): CombinedTestTarget => ({
        id: s.key,
        name: s.name,
        icon: s.icon,
        type: 'streaming',
        status: 'idle',
        latency: -1
      })
    )
  ]
}

function getLatencyColorClass(latency: number): string {
  if (latency < 200) return 'text-success'
  if (latency <= 800) return 'text-warning'
  return 'text-danger'
}

export const ConnectivityTestPanel: React.FC = () => {
  const { t } = useI18n()
  const [testTargets, setTestTargets] = useState<CombinedTestTarget[]>(buildInitialTargets)
  const testTargetsRef = useRef(testTargets)
  testTargetsRef.current = testTargets
  const [allTesting, setAllTesting] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customUrl, setCustomUrl] = useState('')

  const updateTargetById = useCallback(
    (id: string, patch: Partial<CombinedTestTarget>) => {
      setTestTargets((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
    },
    []
  )

  const testSingle = useCallback(
    async (id: string): Promise<void> => {
      const target = testTargetsRef.current.find((item) => item.id === id)
      if (!target) return

      updateTargetById(id, { status: 'testing', region: undefined, error: undefined })

      try {
        if (target.type === 'connectivity') {
          const result = await testConnectivity(target.url!, 5000)
          updateTargetById(id, {
            status: result.success ? 'success' : 'error',
            latency: result.latency,
            error: result.error
          })
        } else {
          const result = await checkStreamingUnlock(target.id)
          updateTargetById(id, {
            status: result.status,
            region: result.region,
            error: result.error
          })
        }
      } catch (e) {
        updateTargetById(id, {
          status: 'error',
          error: e instanceof Error ? e.message : String(e)
        })
      }
    },
    [updateTargetById]
  )

  const testAll = async (): Promise<void> => {
    if (allTesting) return
    setAllTesting(true)
    const ids = testTargetsRef.current.map((item) => item.id)
    setTestTargets((prev) =>
      prev.map((item) => ({
        ...item,
        status: 'queued',
        region: undefined,
        error: undefined
      }))
    )

    try {
      for (let index = 0; index < ids.length; index += TEST_ALL_CONCURRENCY) {
        const batch = ids.slice(index, index + TEST_ALL_CONCURRENCY).map((id) => testSingle(id))
        await Promise.allSettled(batch)
      }
    } finally {
      setAllTesting(false)
    }
  }

  const handleAddCustomTarget = (): void => {
    const trimmedName = customName.trim()
    let trimmedUrl = customUrl.trim()
    if (!trimmedName || !trimmedUrl) return
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      trimmedUrl = `https://${trimmedUrl}`
    }
    const newId = `custom:${Date.now()}`
    const newTarget: CombinedTestTarget = {
      id: newId,
      name: trimmedName,
      url: trimmedUrl,
      type: 'connectivity',
      custom: true,
      status: 'idle',
      latency: -1
    }
    setTestTargets((prev) => {
      const streamingIndex = prev.findIndex((item) => item.type === 'streaming')
      const next =
        streamingIndex === -1
          ? [...prev, newTarget]
          : [...prev.slice(0, streamingIndex), newTarget, ...prev.slice(streamingIndex)]
      saveCustomTargets(
        next
          .filter((item) => item.custom && item.url)
          .map((item) => ({ id: item.id, name: item.name, url: item.url! }))
      )
      return next
    })
    setCustomName('')
    setCustomUrl('')
    setShowAddForm(false)
  }

  const handleRemoveCustomTarget = (id: string): void => {
    setTestTargets((prev) => {
      const next = prev.filter((item) => item.id !== id)
      saveCustomTargets(
        next
          .filter((item) => item.custom && item.url)
          .map((item) => ({ id: item.id, name: item.name, url: item.url! }))
      )
      return next
    })
  }

  const connectivityTargets = testTargets.filter((item) => item.type === 'connectivity')
  const streamingTargets = testTargets.filter((item) => item.type === 'streaming')

  const connectivityOkCount = connectivityTargets.filter((item) => item.status === 'success').length
  const streamingOkCount = streamingTargets.filter((item) => item.status === 'unlocked').length

  const renderTargetCard = (target: CombinedTestTarget): React.ReactNode => (
    <Card
      key={target.id}
      isPressable
      onPress={() =>
        target.status !== 'testing' && target.status !== 'queued' && void testSingle(target.id)
      }
      className={`${CARD_STYLES.GLASS_ITEM_CARD} relative ${target.status === 'testing' ? 'opacity-80 scale-[0.98]' : 'hover:scale-[1.03] hover:bg-primary/5 hover:border-primary/30 hover:shadow-md hover:shadow-primary/10'} transition-all duration-300 border-transparent`}
    >
      {target.custom && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleRemoveCustomTarget(target.id)
          }}
          className="absolute right-1.5 top-1.5 z-10 rounded-full p-0.5 text-foreground-400 hover:bg-danger/15 hover:text-danger transition-colors"
          title={t('common.delete')}
        >
          <IoClose className="text-xs" />
        </button>
      )}
      <CardBody className="p-2 text-center">
        {target.icon ? (
          <RemoteImage
            src={target.icon}
            alt={target.name}
            className="w-6 h-6 mx-auto mb-1"
          />
        ) : (
          <div className="w-6 h-6 mx-auto mb-1 rounded-full bg-primary/15 flex items-center justify-center">
            <IoGlobe className="text-primary text-sm" />
          </div>
        )}
        <div className="text-xs font-medium mb-1.5 truncate" title={target.url || target.name}>
          {target.name}
        </div>
        {target.status === 'testing' ? (
          <div className="text-primary text-xs animate-pulse">{t('tools.testing')}</div>
        ) : target.status === 'queued' ? (
          <div className="text-foreground-400 text-xs">{t('tools.queued')}</div>
        ) : target.status === 'success' || target.status === 'unlocked' ? (
          <div
            className={`inline-flex items-center justify-center gap-1 text-xs whitespace-nowrap animate-fade-in ${
              target.type === 'connectivity'
                ? getLatencyColorClass(target.latency)
                : 'text-success'
            }`}
          >
            <IoCheckmarkCircle className="shrink-0 text-base animate-zoom-in" />
            <span>
              {target.type === 'connectivity'
                ? `${target.latency}ms`
                : target.region || t('tools.unlocked')}
            </span>
          </div>
        ) : target.status === 'locked' ? (
          <div className="inline-flex items-center justify-center gap-1 text-danger text-xs whitespace-nowrap animate-fade-in">
            <IoCloseCircle className="shrink-0 text-base animate-zoom-in" />
            <span>{t('tools.locked')}</span>
          </div>
        ) : target.status === 'error' ? (
          <div
            className="inline-flex items-center justify-center gap-1 text-warning text-xs whitespace-nowrap animate-fade-in"
            title={target.error}
          >
            <IoCloseCircle className="shrink-0 text-base animate-zoom-in" />
            <span>{t('tools.testFailed')}</span>
          </div>
        ) : (
          <div className="text-primary text-xs">{t('tools.clickToTest')}</div>
        )}
      </CardBody>
    </Card>
  )

  return (
    <Card
      className={`${CARD_STYLES.BASE} ${CARD_STYLES.INACTIVE} hover:!scale-100 !cursor-default`}
    >
      <CardBody className="p-2 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-success/20">
              <IoWifi className="text-success text-lg" />
            </div>
            <span className="font-medium">{t('tools.networkTest')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="light"
              onPress={() => setShowAddForm((prev) => !prev)}
              startContent={<IoAdd />}
            >
              {t('tools.addCustomTarget')}
            </Button>
            <Button
              size="sm"
              color="success"
              variant="flat"
              isLoading={allTesting}
              isDisabled={allTesting}
              onPress={() => void testAll()}
              startContent={!allTesting && <IoRefresh />}
            >
              {t('tools.testAll')}
            </Button>
          </div>
        </div>

        {showAddForm && (
          <div className="flex flex-wrap items-center gap-2 p-2 rounded-xl bg-default-100/40 border border-default-200/50 animate-fade-in">
            <Input
              size="sm"
              placeholder={t('tools.customTargetName')}
              value={customName}
              onValueChange={setCustomName}
              className="w-40"
              classNames={CARD_STYLES.GLASS_INPUT}
            />
            <Input
              size="sm"
              placeholder={t('tools.customTargetUrl')}
              value={customUrl}
              onValueChange={setCustomUrl}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTarget()}
              className="flex-1 min-w-[200px]"
              classNames={CARD_STYLES.GLASS_INPUT}
            />
            <Button size="sm" color="primary" onPress={handleAddCustomTarget}>
              {t('common.confirm')}
            </Button>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground-500">
              <IoGlobe className="text-primary" />
              <span>{t('tools.connectivitySection')}</span>
            </div>
            <Chip size="sm" variant="flat" className="h-5 text-[11px]">
              {connectivityOkCount}/{connectivityTargets.length}
            </Chip>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
            {connectivityTargets.map(renderTargetCard)}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground-500">
              <IoPlayCircle className="text-secondary" />
              <span>{t('tools.streamingSection')}</span>
            </div>
            <Chip size="sm" variant="flat" className="h-5 text-[11px]">
              {streamingOkCount}/{streamingTargets.length}
            </Chip>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
            {streamingTargets.map(renderTargetCard)}
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
