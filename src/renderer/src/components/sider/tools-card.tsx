import { LuWrench } from 'react-icons/lu'
import React from 'react'
import SidebarNavCard from './sidebar-nav-card'

interface Props {
  iconOnly?: boolean
}

const ToolsCard: React.FC<Props> = (props) => {
  return <SidebarNavCard {...props} label="工具" path="/tools" icon={LuWrench} />
}

export default ToolsCard
