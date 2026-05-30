import { LuScanSearch } from 'react-icons/lu'
import React from 'react'
import SidebarNavCard, { type SidebarNavItemProps } from './sidebar-nav-card'
import { useI18n } from '@renderer/i18n'

const SnifferCard: React.FC<SidebarNavItemProps> = (props) => {
  const { t } = useI18n()
  return (
    <SidebarNavCard
      {...props}
      label={t('sidebar.sniffer')}
      path="/sniffer"
      icon={LuScanSearch}
      iconOnlySizeClass="text-[16px]"
    />
  )
}

export default SnifferCard
