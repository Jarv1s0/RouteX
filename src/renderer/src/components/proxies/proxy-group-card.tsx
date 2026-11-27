import { Button, Card, CardBody } from '@heroui/react'
import { MdOutlineSpeed } from 'react-icons/md'
import { getImageDataURL } from '@renderer/utils/resource-ipc'
import { useAppStore } from '@renderer/store/use-app-store'
import { useShallow } from 'zustand/react/shallow'
import { useEffect, memo, useMemo, useState } from 'react'
import { addFlag, removeFlag } from '@renderer/utils/flags'
import { useI18n } from '@renderer/i18n'
import { getDelayColorClass } from '@renderer/utils/delay-color'
import { CARD_STYLES } from '@renderer/utils/card-styles'

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

function isAutoGroupType(type: string): boolean {
  const normalized = type.trim().toLowerCase().replace(/[^a-z]/g, '')
  return ['urltest', 'fallback', 'loadbalance', 'smart'].includes(normalized)
}

export function getGroupStatusDotClass(liveCount: number, totalCount: number): string {
  if (totalCount === 0) return 'bg-default-300'
  return liveCount > 0 ? 'bg-success' : 'bg-danger'
}

export const GroupIconBadge: React.FC<{
  icon?: string
  active?: boolean
  size?: 'md' | 'lg'
}> = ({ icon, active = false, size = 'lg' }) => {
  const [iconSrc, setIconSrc] = useState('')
  const [iconLoadFailed, setIconLoadFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const trimmed = icon?.trim() || ''

    setIconLoadFailed(false)

    if (!trimmed) {
      setIconSrc('')
      return
    }

    if (trimmed.startsWith('<svg')) {
      setIconSrc(toSvgDataUrl(trimmed))
      return
    }

    if (!isRemoteIcon(trimmed)) {
      setIconSrc(trimmed)
      return
    }

    const cached = readCachedGroupIcon(trimmed)
    if (cached) {
      setIconSrc(cached)
      return
    }

    setIconSrc('')
    void getImageDataURL(trimmed)
      .then((dataURL) => {
        if (cancelled) {
          return
        }

        writeCachedGroupIcon(trimmed, dataURL)
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
  }, [icon])

  const sizeClass = size === 'lg' ? 'w-7 h-7' : 'w-6 h-6'

  if (iconSrc && !iconLoadFailed) {
    return (
      <img
        className={`${sizeClass} shrink-0 object-contain drop-shadow-sm transition-transform duration-150 ease-out group-hover:scale-[1.06] motion-reduce:transition-none`}
        src={iconSrc}
        alt=""
        onError={(e) => {
          ;(e.currentTarget as HTMLImageElement).style.display = 'none'
          setIconLoadFailed(true)
        }}
      />
    )
  }

  return (
    <div
      className={`${sizeClass} rounded-xl bg-primary/8 dark:bg-primary/15 flex items-center justify-center shrink-0 transition-transform duration-150 ease-out group-hover:scale-[1.06] motion-reduce:transition-none`}
    >
      <div
        className={`w-2 h-2 rounded-full transition-colors ${active ? 'bg-primary' : 'bg-default-400'}`}
      />
    </div>
  )
}

const DEFAULT_DELAY_THRESHOLDS = { good: 200, fair: 500 }

interface Props {
  group: ControllerMixedGroup
  active: boolean
  onOpen: () => void
  delaying: boolean
  currentDelay: number
  liveCount: number
  onGroupDelay: () => Promise<void>
}

const ProxyGroupCardComponent: React.FC<Props> = ({
  group,
  active,
  onOpen,
  delaying,
  currentDelay,
  liveCount,
  onGroupDelay
}) => {
  const { t } = useI18n()
  const delayThresholds = useAppStore(
    useShallow((state) => state.appConfig?.delayThresholds ?? DEFAULT_DELAY_THRESHOLDS)
  )
  const currentProxyIcon = useMemo(() => getCurrentProxyIcon(group), [group.all, group.now])
  const currentProxyLabel = currentProxyIcon
    ? removeFlag(group.now).trim() || group.now
    : addFlag(group.now)

  const totalCount = (group.all || []).length
  const delayColor = getDelayColorClass(currentDelay, delayThresholds, 'text-foreground/65')
  const statusDotClass = getGroupStatusDotClass(liveCount, totalCount)
  const autoGroup = isAutoGroupType(group.type)

  return (
    <Card
      as="div"
      data-proxy-group-card="true"
      isPressable
      fullWidth
      shadow="none"
      radius="lg"
      onPress={onOpen}
      className={`group relative overflow-hidden border antialiased ${
        active ? CARD_STYLES.PROXY_ITEM_SELECTED : CARD_STYLES.PROXY_ITEM_CARD
      }`}
    >
      <CardBody className="w-full px-4 py-3 flex flex-col gap-2">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <GroupIconBadge icon={group.icon} active={active} size="lg" />
            <span
              className="min-w-0 truncate text-[15px] font-bold tracking-tight leading-5 text-foreground"
              title={group.name}
            >
              {group.name}
            </span>
            {autoGroup && (
              <span className="shrink-0 rounded-md bg-primary/10 dark:bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                {group.type}
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-1.5">
            <div
              className="flex shrink-0 items-center"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <Button
                variant="light"
                color={delaying ? 'primary' : 'default'}
                size="sm"
                isIconOnly
                radius="lg"
                aria-label={t('proxies.testGroup')}
                title={t('proxies.testGroup')}
                className={`h-6 w-6 min-w-6 rounded-lg text-foreground/65 hover:text-primary hover:bg-primary/10 transition-opacity duration-150 ${
                  delaying || active
                    ? 'opacity-100'
                    : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
                }`}
                onPress={onGroupDelay}
                isDisabled={delaying}
              >
                {delaying ? (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                ) : (
                  <MdOutlineSpeed className="text-[16px]" />
                )}
              </Button>
            </div>

            <span
              className={`shrink-0 text-sm font-bold font-mono tabular-nums leading-5 ${delayColor}`}
            >
              {currentDelay === -1
                ? '--'
                : currentDelay === 0
                  ? t('proxies.timeout')
                  : currentDelay}
              {currentDelay !== -1 && currentDelay !== 0 && (
                <span className="text-[10px] font-medium text-foreground/65 ml-0.5">ms</span>
              )}
            </span>
          </div>
        </div>

        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDotClass}`} />
            <span className="text-xs font-mono tabular-nums text-foreground/70">
              {liveCount}
              <span className="opacity-45 mx-0.5">/</span>
              {totalCount}
            </span>
          </div>

          <div className="flex items-center justify-end gap-1.5 min-w-0 max-w-[72%]">
            {currentProxyIcon && (
              <img
                className="w-3.5 h-3.5 shrink-0 object-contain"
                src={getIconImageSrc(currentProxyIcon)}
                alt=""
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                }}
              />
            )}
            <span
              className={`flag-emoji min-w-0 truncate text-xs font-medium leading-4 transition-colors duration-150 ${
                currentDelay === 0
                  ? 'text-foreground/60'
                  : 'text-foreground/80 group-hover:text-foreground'
              }`}
              title={group.now}
            >
              {currentProxyLabel}
            </span>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

export const ProxyGroupCard = memo(ProxyGroupCardComponent, (prev, next) => {
  return (
    prev.active === next.active &&
    prev.delaying === next.delaying &&
    prev.currentDelay === next.currentDelay &&
    prev.liveCount === next.liveCount &&
    prev.group.name === next.group.name &&
    prev.group.type === next.group.type &&
    prev.group.icon === next.group.icon &&
    prev.group.now === next.group.now &&
    getCurrentProxyIcon(prev.group) === getCurrentProxyIcon(next.group) &&
    prev.group.all?.length === next.group.all?.length
  )
})
