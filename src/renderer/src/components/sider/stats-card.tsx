import { LuChartColumn, LuGlobe, LuScanSearch } from 'react-icons/lu'
import React from 'react'
import SidebarNavCard, { type SidebarNavItemProps } from './sidebar-nav-card'
import { useI18n } from '@renderer/i18n'

const StatsCard: React.FC<SidebarNavItemProps> = (props) => {
  const { t } = useI18n()

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
      <SidebarNavCard
        {...props}
        label={t('sidebar.dns')}
        path="/dns"
        icon={LuGlobe}
      />
      <SidebarNavCard
        {...props}
        label={t('sidebar.sniffer')}
        path="/sniffer"
        icon={LuScanSearch}
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

export default StatsCard
