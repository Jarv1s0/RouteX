import { LuMap } from 'react-icons/lu'
import React from 'react'
import SidebarNavCard, { type SidebarNavItemProps } from './sidebar-nav-card'

const MapCard: React.FC<SidebarNavItemProps> = (props) => {
  return <SidebarNavCard {...props} label="拓扑" path="/map" icon={LuMap} />
}

export default MapCard
