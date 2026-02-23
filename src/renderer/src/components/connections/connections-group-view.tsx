import React from 'react'
import { Card, CardHeader, CardFooter, Avatar, Chip } from '@heroui/react'
import { IoApps } from 'react-icons/io5'
import { calcTraffic } from '@renderer/utils/calc'
import ConnectionItem from '@renderer/components/connections/connection-item'

interface GroupData {
  process: string
  processPath: string
  connections: ControllerConnectionDetail[]
  totalUpload: number
  totalDownload: number
  uploadSpeed: number
  downloadSpeed: number
}

interface ConnectionsGroupViewProps {
  groupedConnections: GroupData[]
  expandedGroups: Set<string>
  toggleGroup: (process: string) => void
  displayIcon: boolean
  displayAppName: boolean
  findProcessMode: string
  iconMap: Record<string, string>
  appNameCache: Record<string, string>
  tab: string
  selected?: ControllerConnectionDetail
  setSelected: React.Dispatch<React.SetStateAction<ControllerConnectionDetail | undefined>>
  setIsDetailModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  closeConnection: (id: string) => void
  hideConnection: (id: string) => void
  unhideConnection: (id: string) => void
  hiddenRules: Set<string>
  handleContextMenu: (conn: ControllerConnectionDetail, e: React.MouseEvent) => void
}

// 连接分组视图组件
const ConnectionsGroupView: React.FC<ConnectionsGroupViewProps> = ({
  groupedConnections,
  expandedGroups,
  toggleGroup,
  displayIcon,
  displayAppName,
  findProcessMode,
  iconMap,
  appNameCache,
  tab,
  selected,
  setSelected,
  setIsDetailModalOpen,
  closeConnection,
  hideConnection,
  unhideConnection,
  hiddenRules,
  handleContextMenu
}) => {
  return (
    <div className="p-2 space-y-3">
      {groupedConnections.map(group => {
        const isExpanded = expandedGroups.has(group.process)
        const iconUrl = (displayIcon && findProcessMode !== 'off' && iconMap[group.processPath]) || ''
        const displayName = displayAppName && group.processPath ? appNameCache[group.processPath] : undefined
        const processName = displayName || group.process.replace(/\.exe$/, '')
        
        return (
          <div key={group.process}>
            {/* 分组头部卡片 */}
            <Card
              isPressable
              className="w-full hover:bg-primary/30 transition-all duration-200"
              onPress={() => toggleGroup(group.process)}
            >
              <div className="w-full flex justify-between items-center">
                {displayIcon && (
                  <div>
                    <Avatar
                      size="md"
                      radius="sm"
                      src={iconUrl}
                      className="bg-transparent ml-2 w-12 h-12"
                      fallback={<IoApps className="text-default-400" />}
                    />
                  </div>
                )}
                <div className={`w-full flex flex-col justify-start truncate relative ${displayIcon ? '-ml-2' : ''}`}>
                  <CardHeader className="pb-0 gap-1 flex items-center pr-4">
                    <div className="ml-2 flex-1 text-ellipsis whitespace-nowrap overflow-hidden text-left font-medium">
                      {processName}
                    </div>
                    <Chip size="sm" variant="flat" color="primary" className="mr-2">
                      {group.connections.length} 连接
                    </Chip>
                    <span className="text-foreground-400 text-sm">
                      {isExpanded ? '▼' : '▶'}
                    </span>
                  </CardHeader>
                  <CardFooter className="pt-2">
                    <div className="flex gap-1 overflow-x-auto no-scrollbar">
                      <Chip color="primary" size="sm" radius="sm" variant="dot">
                        {tab === 'active' ? '活动中' : '已关闭'}
                      </Chip>
                      <Chip size="sm" radius="sm" variant="bordered">
                        <span style={{ color: '#22d3ee' }}>↑ {calcTraffic(group.totalUpload)}</span>
                        {' '}
                        <span style={{ color: '#c084fc' }}>↓ {calcTraffic(group.totalDownload)}</span>
                      </Chip>
                      {(group.uploadSpeed > 0 || group.downloadSpeed > 0) && (
                        <Chip color="primary" size="sm" radius="sm" variant="bordered">
                          <span style={{ color: '#22d3ee' }}>↑ {calcTraffic(group.uploadSpeed)}/s</span>
                          {' '}
                          <span style={{ color: '#c084fc' }}>↓ {calcTraffic(group.downloadSpeed)}/s</span>
                        </Chip>
                      )}
                    </div>
                  </CardFooter>
                </div>
              </div>
            </Card>
            
            {/* 展开的连接列表 */}
            {isExpanded && (
              <div className="ml-6 mt-1 border-l-2 border-primary/30 pl-2">
                {group.connections.map((conn, i) => {
                  const path = conn.metadata.processPath || ''
                  const connIconUrl = (displayIcon && findProcessMode !== 'off' && iconMap[path]) || ''
                  const connDisplayName = displayAppName && conn.metadata.processPath 
                    ? appNameCache[conn.metadata.processPath] 
                    : undefined
                  
                  return (
                    <ConnectionItem
                      key={conn.id}
                      setSelected={setSelected}
                      setIsDetailModalOpen={setIsDetailModalOpen}
                      selected={selected}
                      iconUrl={connIconUrl}
                      displayIcon={false}
                      displayName={connDisplayName}
                      close={closeConnection}
                      hide={hideConnection}
                      unhide={unhideConnection}
                      isHidden={hiddenRules.has(`${conn.metadata.process || 'unknown'}:${conn.metadata.host || conn.metadata.destinationIP || 'unknown'}`)}
                      index={i}
                      info={conn}
                      onContextMenu={handleContextMenu}
                    />
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default ConnectionsGroupView
