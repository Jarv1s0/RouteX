import { LuChartColumn } from 'react-icons/lu'
import React from 'react'
import SidebarNavCard, { type SidebarNavItemProps } from './sidebar-nav-card'

const StatsCard: React.FC<SidebarNavItemProps> = (props) => {
  return <SidebarNavCard {...props} label="统计" path="/stats" icon={LuChartColumn} iconOnlySizeClass="text-[17px]" />
}

export default StatsCard
