import { LuServerCog } from 'react-icons/lu'
import React from 'react'
import SidebarNavCard, { type SidebarNavItemProps } from './sidebar-nav-card'
import { useI18n } from '@renderer/i18n'

const DnsCard: React.FC<SidebarNavItemProps> = (props) => {
  const { t } = useI18n()
  return (
    <SidebarNavCard
      {...props}
      label={t('sidebar.dns')}
      path="/dns"
      icon={LuServerCog}
      iconOnlySizeClass="text-[16px]"
    />
  )
}

export default DnsCard
