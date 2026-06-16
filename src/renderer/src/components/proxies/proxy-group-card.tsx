import { Button, Card, CardBody } from '@heroui/react'
import { MdOutlineSpeed } from 'react-icons/md'
import { getImageDataURL } from '@renderer/utils/resource-ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useEffect, memo, useMemo, useState } from 'react'
import { addFlag, removeFlag } from '@renderer/utils/flags'
import { useI18n } from '@renderer/i18n'
import { getDelayColorClass } from '@renderer/utils/delay-color'

function isRemoteIcon(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function toSvgDataUrl(value: string): string {
  return `data:image/svg+xml;utf8,${value}`
}

function readCachedGroupIcon(icon: string): string | null {
  try {
    const cached = localStorage.getItem(icon)
    if (!cached) {
      return null
    }

    if (isRemoteIcon(cached)) {
      localStorage.removeItem(icon)
      return null
    }

    return cached
  } catch {
    return null
  }
}

function writeCachedGroupIcon(icon: string, src: string): void {
  if (isRemoteIcon(src)) {
    return
  }

  try {
    localStorage.setItem(icon, src)
  } catch {
    // ignore cache write failure
  }
}

type ProxyListItem = ControllerProxiesDetail | ControllerGroupDetail

function isProxyListItem(value: unknown): value is ProxyListItem {
  return Boolean(value && typeof value === 'object' && 'name' in value)
}

function getCurrentProxyIcon(group: ControllerMixedGroup): string {
  const currentProxy = (group.all || []).find(
    (proxy): proxy is ProxyListItem => isProxyListItem(proxy) && proxy.name === group.now
  )

  return currentProxy?.icon?.trim() || ''
}

function getIconImageSrc(icon: string): string {
  return icon.startsWith('<svg') ? toSvgDataUrl(icon) : icon
}

interface Props {
  group: ControllerMixedGroup
  isOpen: boolean
  toggleOpen: () => void
  delaying: boolean
  delayVersion: string
  currentDelay: number
  liveCount: number
  onGroupDelay: () => Promise<void>
  mutate: () => void
}

const ProxyGroupCardComponent: React.FC<Props> = ({
  group,
  isOpen,
  toggleOpen,
  delaying,
  currentDelay,
  liveCount,
  onGroupDelay
}) => {
  const { appConfig } = useAppConfig()
  const { t } = useI18n()
  const { delayThresholds = { good: 200, fair: 500 } } = appConfig || {}
  const [iconSrc, setIconSrc] = useState('')
  const [iconLoadFailed, setIconLoadFailed] = useState(false)
  const currentProxyIcon = useMemo(() => getCurrentProxyIcon(group), [group.all, group.now])
  const currentProxyLabel = currentProxyIcon
    ? removeFlag(group.now).trim() || group.now
    : addFlag(group.now)

  const delayColor = getDelayColorClass(currentDelay, delayThresholds, 'text-default-400')

  // Icon handling
  useEffect(() => {
    let cancelled = false
    const icon = group.icon?.trim() || ''

    setIconLoadFailed(false)

    if (!icon) {
      setIconSrc('')
      return
    }

    if (icon.startsWith('<svg')) {
      setIconSrc(toSvgDataUrl(icon))
      return
    }

    if (!isRemoteIcon(icon)) {
      setIconSrc(icon)
      return
    }

    const cached = readCachedGroupIcon(icon)
    if (cached) {
      setIconSrc(cached)
      return
    }

    setIconSrc('')
    void getImageDataURL(icon)
      .then((dataURL) => {
        if (cancelled) {
          return
        }

        writeCachedGroupIcon(icon, dataURL)
        setIconSrc(dataURL)
      })
      .catch(() => {
        if (!cancelled) {
          setIconLoadFailed(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [group.icon])

  const activeStyle = isOpen
    ? 'bg-gradient-to-br from-default-100/90 to-default-50/80 dark:from-default-50/60 dark:to-default-100/40 backdrop-blur-xl border-default-200/50 dark:border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_8px_24px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_8px_24px_rgba(0,0,0,0.15)] relative z-10 hover:-translate-y-[1px]'
    : 'bg-default-50/50 dark:bg-default-50/20 backdrop-blur-md border-white/20 dark:border-white/5 shadow-sm hover:bg-default-100/70 dark:hover:bg-white/5 hover:shadow-md hover:border-default-300/40 dark:hover:border-white/10 hover:-translate-y-[1px]'

  return (
    <div className="w-full pt-2 px-2">
      <Card
        as="div"
        isPressable
        fullWidth
        onPress={toggleOpen}
        className={`transition-all duration-300 border group ${activeStyle}`}
      >
        <CardBody className="w-full py-3 px-4 min-h-[64px] flex justify-center">
          {/* Header Row */}
          <div className="flex justify-between items-center">
            {/* Left: Info */}
            <div className="flex items-center gap-4">
              {iconSrc && !iconLoadFailed ? (
                <img
                  className="w-6 h-6 object-contain flex-shrink-0"
                  src={iconSrc}
                  alt=""
                  onError={(e) => {
                    ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                    setIconLoadFailed(true)
                  }}
                />
              ) : (
                <div
                  className={`w-6 h-6 flex-shrink-0 flex items-center justify-center ${isOpen ? 'text-primary' : 'text-default-500'}`}
                >
                  <div className="w-2 h-2 rounded-full bg-current" />
                </div>
              )}

              <div className="flex flex-col items-start gap-0.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`font-bold text-base tracking-tight transition-colors ${isOpen ? 'text-foreground' : 'text-foreground/80'}`}
                  >
                    {group.name}
                  </span>
                  <span className="inline-flex h-[18px] items-center rounded bg-default-100/80 dark:bg-white/5 px-1.5 text-[9px] font-bold uppercase tracking-wider text-default-500/80 dark:text-default-400">
                    {group.type}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center px-3 py-1 rounded-md bg-default-100/80 border border-default-200/50 hover:bg-default-200/50 transition-colors">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider mr-2 transition-colors duration-500 ${delayColor}`}
                    >
                      Live
                    </span>
                    <span className="text-xs font-mono font-medium text-foreground/80">
                      {liveCount}
                      <span className="opacity-40 mx-0.5">/</span>
                      {(group.all || []).length}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Controls & Delay */}
            <div className="flex items-center gap-2">
              <div className="flex items-center overflow-visible bg-default-100/50 dark:bg-default-50/50 border border-default-200/50 rounded-xl px-1.5 py-1.5 backdrop-blur-md transition-colors hover:bg-default-200/50">
                {/* Node Name */}
                <div className="flex items-center max-w-[140px] overflow-visible px-2 border-r border-default-200/50">
                  <span
                    className={`text-[12.5px] font-medium leading-5 truncate flag-emoji tracking-wide flex items-center gap-1.5 overflow-visible transition-colors ${currentDelay === 0 ? 'text-default-400' : 'text-foreground/80'}`}
                    title={group.now}
                  >
                    {currentProxyIcon && (
                      <img
                        className="w-4 h-4 object-contain flex-shrink-0"
                        src={getIconImageSrc(currentProxyIcon)}
                        alt=""
                        onError={(e) => {
                          ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    )}
                    {currentProxyLabel}
                  </span>
                </div>

                {/* Delay Value */}
                <div className="flex items-center justify-center min-w-[54px] px-2">
                  <span className={`text-sm font-bold font-mono ${delayColor}`}>
                    {currentDelay === -1
                      ? '--'
                      : currentDelay === 0
                        ? t('proxies.timeout')
                        : `${currentDelay}`}
                  </span>
                  {currentDelay !== -1 && currentDelay !== 0 && (
                    <span className="text-[10px] font-medium text-foreground-400 ml-[1px]">ms</span>
                  )}
                </div>
              </div>

              {isOpen && (
                <div
                  className="flex items-center animate-appearance-in"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="flat"
                    color="primary"
                    size="sm"
                    isIconOnly
                    radius="lg"
                    className="bg-primary/10 hover:bg-primary/20 text-primary shadow-sm"
                    onPress={onGroupDelay}
                    isDisabled={delaying}
                  >
                    {delaying ? (
                      <div className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                    ) : (
                      <MdOutlineSpeed className="text-lg" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardBody>
        {isOpen && (
          <div className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full bg-gradient-to-r from-transparent via-primary/55 to-transparent" />
        )}
      </Card>
    </div>
  )
}

export const ProxyGroupCard = memo(ProxyGroupCardComponent, (prev, next) => {
  // Only update if relevant props changed
  return (
    prev.isOpen === next.isOpen &&
    prev.delaying === next.delaying &&
    prev.delayVersion === next.delayVersion &&
    prev.currentDelay === next.currentDelay &&
    prev.liveCount === next.liveCount &&
    prev.group.name === next.group.name &&
    prev.group.icon === next.group.icon &&
    prev.group.now === next.group.now &&
    getCurrentProxyIcon(prev.group) === getCurrentProxyIcon(next.group) &&
    prev.group.all?.length === next.group.all?.length
  )
})
