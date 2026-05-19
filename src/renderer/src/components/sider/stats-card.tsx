import { LuChartColumn, LuGlobe, LuScanSearch } from 'react-icons/lu'
import React from 'react'
import SidebarNavCard, { type SidebarNavItemProps } from './sidebar-nav-card'
import SidebarTrailingSwitch from './sidebar-trailing-switch'
import { useI18n } from '@renderer/i18n'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { navigateSidebarRoute, preloadSidebarRoute } from '@renderer/routes'
import { useLocation } from 'react-router-dom'
import { patchControledMihomoConfig } from '@renderer/utils/mihomo-ipc'
import { restartCoreInBackground } from '@renderer/utils/core-restart'
import { toast } from 'sonner'

interface RuntimeControlRowProps {
  label: string
  enabled: boolean
  path: string
  icon: React.ComponentType<{ className?: string }>
  onToggle: (enabled: boolean) => Promise<void>
}

const RuntimeControlRow: React.FC<RuntimeControlRowProps> = ({
  label,
  enabled,
  path,
  icon: Icon,
  onToggle
}) => {
  const location = useLocation()
  const match = location.pathname.includes(path)
  const handleNavigate = (): void => {
    navigateSidebarRoute(path)
  }
  const handlePreload = (): void => {
    preloadSidebarRoute(path)
  }
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    event.preventDefault()
    handleNavigate()
  }

  return (
    <div
      className={`app-nodrag flex h-[34px] cursor-pointer items-center justify-between gap-2 rounded-xl px-3 transition-colors group ${
        match ? CARD_STYLES.SIDEBAR_ACTIVE : CARD_STYLES.SIDEBAR_ITEM
      }`}
      onFocus={handlePreload}
      onMouseEnter={handlePreload}
      onMouseDown={handlePreload}
      onClick={handleNavigate}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
          <Icon className="text-[15px] text-default-500 transition-colors group-hover:text-primary" />
        </span>
        <span className="truncate text-sm font-medium leading-none text-foreground/90 transition-colors group-hover:text-foreground">
          {label}
        </span>
      </div>
      <SidebarTrailingSwitch
        isSelected={enabled}
        aria-label={label}
        onValueChange={(value) => void onToggle(value)}
      />
    </div>
  )
}

const StatsCard: React.FC<SidebarNavItemProps> = (props) => {
  const { t } = useI18n()
  const { appConfig, patchAppConfig } = useAppConfig()
  const { controlDns = true, controlSniff = true } = appConfig || {}

  const handleToggleControlDns = async (value: boolean): Promise<void> => {
    try {
      await patchAppConfig({ controlDns: value })
      await patchControledMihomoConfig({})
      restartCoreInBackground(t('settings.dnsControl.applyFailed'))
    } catch (error) {
      toast.error(String(error))
    }
  }

  const handleToggleControlSniff = async (value: boolean): Promise<void> => {
    try {
      await patchAppConfig({ controlSniff: value })
      await patchControledMihomoConfig({})
      restartCoreInBackground(t('settings.sniffControl.applyFailed'))
    } catch (error) {
      toast.error(String(error))
    }
  }

  if (props.iconOnly) {
    return (
      <div className="flex flex-col gap-2">
        <SidebarNavCard
          {...props}
          label={t('sidebar.dns')}
          path="/dns"
          icon={LuGlobe}
          iconOnlySizeClass="text-[16px]"
        />
        <SidebarNavCard
          {...props}
          label={t('sidebar.sniffer')}
          path="/sniffer"
          icon={LuScanSearch}
          iconOnlySizeClass="text-[16px]"
        />
        <SidebarNavCard
          {...props}
          label={t('sidebar.stats')}
          path="/stats"
          icon={LuChartColumn}
          iconOnlySizeClass="text-[17px]"
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <RuntimeControlRow
        label={t('sidebar.dns')}
        enabled={controlDns}
        path="/dns"
        icon={LuGlobe}
        onToggle={handleToggleControlDns}
      />
      <RuntimeControlRow
        label={t('sidebar.sniffer')}
        enabled={controlSniff}
        path="/sniffer"
        icon={LuScanSearch}
        onToggle={handleToggleControlSniff}
      />
      <div className="mx-1 my-0.5 h-[1px] bg-default-200/55 dark:bg-white/10" />
      <SidebarNavCard
        {...props}
        label={t('sidebar.stats')}
        path="/stats"
        icon={LuChartColumn}
        iconOnlySizeClass="text-[17px]"
      />
    </div>
  )
}

export default StatsCard
