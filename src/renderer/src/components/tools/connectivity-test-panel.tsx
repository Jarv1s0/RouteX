import React, { useState, useRef } from 'react'
import { Card, CardBody, Button } from '@heroui/react'
import { IoWifi, IoRefresh, IoCheckmarkCircle, IoCloseCircle } from 'react-icons/io5'
import { RemoteImage } from '@renderer/components/base/remote-image'
import { testConnectivity, checkStreamingUnlock } from '@renderer/utils/tools-ipc'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { useI18n } from '@renderer/i18n'

interface CombinedTestTarget {
  id: string
  name: string
  url?: string
  icon: string
  type: 'connectivity' | 'streaming'
  status: 'idle' | 'testing' | 'success' | 'locked' | 'unlocked' | 'error'
  latency: number
  region?: string
  error?: string
}

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

const defaultTestTargets: CombinedTestTarget[] = [
  ...defaultTargets.map((t) => ({
    id: t.name,
    ...t,
    type: 'connectivity' as const,
    status: 'idle' as const,
    latency: -1
  })),
  ...defaultStreamingServices.map((s) => ({
    id: s.key,
    name: s.name,
    icon: s.icon,
    type: 'streaming' as const,
    status: 'idle' as const,
    latency: -1
  }))
]

const TEST_ALL_CONCURRENCY = 4

export const ConnectivityTestPanel: React.FC = () => {
  const { t } = useI18n()
  const [testTargets, setTestTargets] = useState<CombinedTestTarget[]>(defaultTestTargets)
  const testTargetsRef = useRef(testTargets)
  testTargetsRef.current = testTargets
  const [allTesting, setAllTesting] = useState(false)

  const testSingle = async (index: number): Promise<void> => {
    setTestTargets((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], status: 'testing', region: undefined, error: undefined }
      return next
    })

    const target = testTargetsRef.current[index]
    if (!target) return
    try {
      if (target.type === 'connectivity') {
        const result = await testConnectivity(target.url!, 5000)
        setTestTargets((prev) => {
          const next = [...prev]
          next[index] = {
            ...next[index],
            status: result.success ? 'success' : 'error',
            latency: result.latency,
            error: result.error
          }
          return next
        })
      } else {
        const result = await checkStreamingUnlock(target.id)
        setTestTargets((prev) => {
          const next = [...prev]
          next[index] = {
            ...next[index],
            status: result.status,
            region: result.region,
            error: result.error
          }
          return next
        })
      }
    } catch (e) {
      setTestTargets((prev) => {
        const next = [...prev]
        next[index] = {
          ...next[index],
          status: 'error',
          error: e instanceof Error ? e.message : String(e)
        }
        return next
      })
    }
  }

  const testAll = async (): Promise<void> => {
    setAllTesting(true)
    setTestTargets((prev) =>
      prev.map(
        (t): CombinedTestTarget => ({
          ...t,
          status: 'testing',
          region: undefined,
          error: undefined
        })
      )
    )

    for (let index = 0; index < testTargetsRef.current.length; index += TEST_ALL_CONCURRENCY) {
      const batch = testTargetsRef.current
        .slice(index, index + TEST_ALL_CONCURRENCY)
        .map((_, batchIndex) => testSingle(index + batchIndex))

      await Promise.allSettled(batch)
    }

    setAllTesting(false)
  }

  return (
    <Card className={`${CARD_STYLES.BASE} ${CARD_STYLES.INACTIVE} hover:!scale-100 !cursor-default`}>
      <CardBody className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-success/20">
              <IoWifi className="text-success text-lg" />
            </div>
            <span className="font-medium">{t('tools.networkTest')}</span>
          </div>
          <Button
            size="sm"
            color="success"
            variant="flat"
            isLoading={allTesting}
            onPress={testAll}
            startContent={!allTesting && <IoRefresh />}
          >
            {t('tools.testAll')}
          </Button>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
          {testTargets.map((target, index) => (
            <Card
              key={target.id}
              isPressable
              onPress={() => target.status !== 'testing' && testSingle(index)}
              className={`${CARD_STYLES.GLASS_ITEM_CARD} ${target.status === 'testing' ? 'opacity-70 scale-[0.98]' : 'hover:scale-[1.05] hover:bg-primary/5 hover:border-primary/30 hover:shadow-md hover:shadow-primary/10'} transition-all duration-300 border-transparent`}
            >
              <CardBody className="p-3 text-center">
                <RemoteImage
                  src={target.icon}
                  alt={target.name}
                  className="w-6 h-6 mx-auto mb-1"
                />
                <div className="text-xs font-medium mb-2">{target.name}</div>
                {target.status === 'testing' ? (
                  <div className="text-primary text-xs animate-pulse">{t('tools.testing')}</div>
                ) : target.status === 'success' || target.status === 'unlocked' ? (
                  <div className="inline-flex items-center justify-center gap-1 text-success text-xs whitespace-nowrap animate-in fade-in duration-200">
                    <IoCheckmarkCircle className="shrink-0 text-base animate-in zoom-in duration-200" />
                    <span>
                      {target.type === 'connectivity'
                        ? `${target.latency}ms`
                        : target.region || t('tools.unlocked')}
                    </span>
                  </div>
                ) : target.status === 'locked' ? (
                  <div className="inline-flex items-center justify-center gap-1 text-danger text-xs whitespace-nowrap animate-in fade-in duration-200">
                    <IoCloseCircle className="shrink-0 text-base animate-in zoom-in duration-200" />
                    <span>{t('tools.locked')}</span>
                  </div>
                ) : target.status === 'error' ? (
                  <div
                    className="inline-flex items-center justify-center gap-1 text-warning text-xs whitespace-nowrap animate-in fade-in duration-200"
                    title={target.error}
                  >
                    <IoCloseCircle className="shrink-0 text-base animate-in zoom-in duration-200" />
                    <span>{t('tools.testFailed')}</span>
                  </div>
                ) : (
                  <div className="text-primary text-xs">{t('tools.clickToTest')}</div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}
