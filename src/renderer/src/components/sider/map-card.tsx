import { LuMap } from 'react-icons/lu'
import React from 'react'
import SidebarNavCard from './sidebar-nav-card'

interface Props {
  iconOnly?: boolean
}

const MapCard: React.FC<Props> = (props) => {
  return <SidebarNavCard {...props} label="拓扑" path="/map" icon={LuMap} />
}

export default MapCard
