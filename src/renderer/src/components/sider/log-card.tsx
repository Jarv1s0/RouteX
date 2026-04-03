import { LuFileText } from 'react-icons/lu'
import React from 'react'
import SidebarNavCard from './sidebar-nav-card'

interface Props {
  iconOnly?: boolean
}

const LogCard: React.FC<Props> = (props) => {
  return <SidebarNavCard {...props} label="日志" path="/logs" icon={LuFileText} iconOnlySizeClass="text-[17px]" />
}

export default LogCard
