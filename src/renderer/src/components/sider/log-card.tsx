import { LuFileText } from 'react-icons/lu'
import React from 'react'
import SidebarNavCard, { type SidebarNavItemProps } from './sidebar-nav-card'

const LogCard: React.FC<SidebarNavItemProps> = (props) => {
  return <SidebarNavCard {...props} label="日志" path="/logs" icon={LuFileText} iconOnlySizeClass="text-[17px]" />
}

export default LogCard
