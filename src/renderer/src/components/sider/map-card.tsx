import { LuMap } from 'react-icons/lu'
import React from 'react'
import SidebarNavCard, { type SidebarNavItemProps } from './sidebar-nav-card'
import { useI18n } from '@renderer/i18n'

const MapCard: React.FC<SidebarNavItemProps> = (props) => {
  const { t } = useI18n()
  return <SidebarNavCard {...props} label={t('sidebar.topology')} path="/map" icon={LuMap} />
}

export default MapCard
