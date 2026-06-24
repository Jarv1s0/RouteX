import { Button, Tooltip } from '@heroui/react'
import { useProfileConfig } from '@renderer/hooks/use-profile-config'
import { useLocation } from 'react-router-dom'
import { calcTraffic } from '@renderer/utils/calc'
import { LuCloud, LuFileCode, LuRotateCw, LuRss } from 'react-icons/lu'
import React, { Suspense, useMemo, useState } from 'react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { navigateSidebarRoute, preloadSidebarRoute } from '@renderer/routes'
import { useI18n } from '@renderer/i18n'

const ConfigViewer = React.lazy(() => import('./config-viewer'))
const RELATIVE_TIME_RANGES: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 60 * 60 * 24 * 365],
  ['month', 60 * 60 * 24 * 30],
  ['week', 60 * 60 * 24 * 7],
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60]
]

function formatRelativeTime(
  timestamp: number | undefined,
  formatter: Intl.RelativeTimeFormat,
  t: ReturnType<typeof useI18n>['t']
): string {
  if (!timestamp) {
    return '-'
  }

  const diffSeconds = Math.round((timestamp - Date.now()) / 1000)
  const absSeconds = Math.abs(diffSeconds)

  if (absSeconds < 45) {
    return diffSeconds >= 0 ? t('time.inFewSeconds') : t('time.fewSecondsAgo')
  }

  const [unit, secondsPerUnit] =
    RELATIVE_TIME_RANGES.find(([, secondsPerUnit]) => absSeconds >= secondsPerUnit) ??
    RELATIVE_TIME_RANGES[RELATIVE_TIME_RANGES.length - 1]

  return formatter.format(Math.round(diffSeconds / secondsPerUnit), unit)
}

function formatShortDateFromUnixSeconds(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const year = date.getFullYear().toString().slice(-2)
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')

  return `${year}/${month}/${day}`
}

interface Props {
  iconOnly?: boolean
  compact?: boolean
  className?: string
}

const ProfileCard: React.FC<Props> = (props) => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const { t, locale } = useI18n()
  const { iconOnly, compact, className = '' } = props
  const { profileDisplayDate = 'expire' } = appConfig || {}
  const location = useLocation()
  const match = location.pathname.includes('/profiles')
  const handleNavigate = (): void => {
    navigateSidebarRoute('/profiles')
  }
  const handlePreload = (): void => {
    preloadSidebarRoute('/profiles')
  }
  const [updating, setUpdating] = useState(false)
  const [showRuntimeConfig, setShowRuntimeConfig] = useState(false)
  const { profileConfig, addProfileItem } = useProfileConfig()
  const { current, items, actives } = profileConfig ?? {}
  const relativeTimeFormatter = useMemo(
    () => new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }),
    [locale]
  )
  const activeIds = actives && actives.length > 0 ? actives : current ? [current] : []
  const activeCount = activeIds.length

  const info = items?.find((item) => item.id === current) ?? {
    id: 'default',
    type: 'local',
    name: t('sidebar.blankProfile')
  }

  const extra = info?.extra
  const usage = (extra?.upload ?? 0) + (extra?.download ?? 0)
  const total = extra?.total ?? 0

  if (iconOnly) {
    return (
      <div className={`flex justify-center`}>
        <Tooltip content={t('sidebar.profiles')} placement="right">
          <Button
            size="sm"
            isIconOnly
            color={match ? 'primary' : 'default'}
            variant={match ? 'solid' : 'light'}
            onFocus={handlePreload}
            onMouseEnter={handlePreload}
            onPress={handleNavigate}
          >
            <LuRss className="text-[17px]" />
          </Button>
        </Tooltip>
      </div>
    )
  }

  return (
    <div
      className={`profile-card flex min-h-0 flex-col ${compact ? 'justify-between gap-1.5 px-3 py-2' : 'gap-1.5 p-2 px-3'} ${className} rounded-xl cursor-pointer transition-colors group ${
        match ? CARD_STYLES.SIDEBAR_ACTIVE : CARD_STYLES.SIDEBAR_ITEM
      }`}
      onMouseEnter={handlePreload}
      onClick={handleNavigate}
    >
      {showRuntimeConfig && (
        <Suspense fallback={null}>
          <ConfigViewer onClose={() => setShowRuntimeConfig(false)} />
        </Suspense>
      )}

      <div className="flex items-center justify-between h-7">
        <div className="flex items-center gap-1.5 overflow-hidden flex-1">
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
            <LuCloud
              className={`text-[16px] transition-colors text-default-700 dark:text-default-300 group-hover:text-foreground`}
            />
          </span>
          <h3
            className={`${compact ? 'text-[13px]' : 'text-sm'} font-semibold truncate transition-colors text-foreground dark:text-foreground/90 group-hover:text-foreground`}
            title={activeCount > 1 ? `${info.name} +${activeCount - 1}` : info.name}
          >
            {activeCount > 1 ? `${info.name} +${activeCount - 1}` : info.name}
          </h3>
        </div>
        <div
          className="flex shrink-0 items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            isIconOnly
            size="sm"
            className={`${compact ? 'w-5 h-5' : 'w-6 h-6'} min-w-0`}
            title={t('sidebar.runtimeConfig')}
            variant="light"
            onPress={() => setShowRuntimeConfig(true)}
          >
            <LuFileCode className={compact ? 'text-[13px]' : 'text-[14px]'} />
          </Button>
          {info.type === 'remote' && (
            <Tooltip
              delay={300}
              placement="left"
              content={formatRelativeTime(info.updated, relativeTimeFormatter, t)}
            >
              <Button
                isIconOnly
                size="sm"
                className={`${compact ? 'w-5 h-5' : 'w-6 h-6'} min-w-0`}
                disabled={updating}
                variant="light"
                onPress={async () => {
                  setUpdating(true)
                  try {
                    await addProfileItem(info)
                  } finally {
                    setUpdating(false)
                  }
                }}
              >
                <LuRotateCw
                  className={`${compact ? 'text-[13px]' : 'text-[14px]'} ${updating ? 'animate-spin' : ''}`}
                />
              </Button>
            </Tooltip>
          )}
        </div>
      </div>

      {info.type === 'remote' && extra && (
        <div
          className={`flex justify-between items-center ${compact ? 'text-[10px]' : 'text-[11px]'} text-foreground/75 dark:text-foreground/70 px-0.5`}
        >
          <span>
            {calcTraffic(usage)} / {calcTraffic(total)}
          </span>
          <span
            className="cursor-pointer hover:text-primary transition-colors hover:underline"
            onClick={(e) => {
              e.stopPropagation()
              patchAppConfig({
                profileDisplayDate: profileDisplayDate === 'expire' ? 'update' : 'expire'
              })
            }}
          >
            {profileDisplayDate === 'expire'
              ? extra.expire
                ? formatShortDateFromUnixSeconds(extra.expire)
                : t('sidebar.longTerm')
              : formatRelativeTime(info.updated, relativeTimeFormatter, t)}
          </span>
        </div>
      )}

      {info.type === 'remote' && !extra && (
        <div
          className={`flex justify-between items-center ${compact ? 'text-[10px]' : 'text-[11px]'} text-foreground/70 dark:text-foreground/65 px-0.5`}
        >
          <span>{t('sidebar.remoteProfile')}</span>
          <span>{formatRelativeTime(info.updated, relativeTimeFormatter, t)}</span>
        </div>
      )}
      {info.type === 'local' && (
        <div
          className={`flex justify-between items-center ${compact ? 'text-[10px]' : 'text-[11px]'} text-foreground/70 dark:text-foreground/65 px-0.5`}
        >
          <span>{t('sidebar.localProfile')}</span>
        </div>
      )}
    </div>
  )
}

export default ProfileCard
