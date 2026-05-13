import { LuFileText } from 'react-icons/lu'
import React from 'react'
import SidebarNavCard, { type SidebarNavItemProps } from './sidebar-nav-card'
import { useI18n } from '@renderer/i18n'

const LogCard: React.FC<SidebarNavItemProps> = (props) => {
  const { t } = useI18n()
  return <SidebarNavCard {...props} label={t('sidebar.logs')} path="/logs" icon={LuFileText} iconOnlySizeClass="text-[17px]" />
}

export default LogCard
