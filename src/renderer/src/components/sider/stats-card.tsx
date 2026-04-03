import { LuChartColumn } from 'react-icons/lu'
import React from 'react'
import SidebarNavCard from './sidebar-nav-card'

interface Props {
  iconOnly?: boolean
}

const StatsCard: React.FC<Props> = (props) => {
  return <SidebarNavCard {...props} label="统计" path="/stats" icon={LuChartColumn} iconOnlySizeClass="text-[17px]" />
}

export default StatsCard
