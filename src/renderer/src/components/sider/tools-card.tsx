import { LuWrench } from 'react-icons/lu'
import React from 'react'
import SidebarNavCard, { type SidebarNavItemProps } from './sidebar-nav-card'

const ToolsCard: React.FC<SidebarNavItemProps> = (props) => {
  return <SidebarNavCard {...props} label="工具" path="/tools" icon={LuWrench} />
}

export default ToolsCard
