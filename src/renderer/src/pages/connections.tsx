import BasePage from '@renderer/components/base/base-page'
import EmptyState from '@renderer/components/base/empty-state'
import { mihomoCloseAllConnections, mihomoCloseConnection } from '@renderer/utils/ipc'
import React, { Key, useCallback, useEffect, useMemo, useState, useDeferredValue } from 'react'
import { Button, Input, Select, SelectItem, Tab, Tabs, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@heroui/react'

import ConnectionItem from '@renderer/components/connections/connection-item'
import ConnectionsGroupView from '@renderer/components/connections/connections-group-view'
import ConnectionTable from '@renderer/components/connections/connection-table'
import { Virtuoso } from 'react-virtuoso'
import dayjs from 'dayjs'
import ConnectionDetailModal from '@renderer/components/connections/connection-detail-modal'
import ConnectionSettingModal from '@renderer/components/connections/connection-setting-modal'
import CreateRuleModal from '@renderer/components/connections/create-rule-modal'
import { CgClose, CgTrash } from 'react-icons/cg'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { includesIgnoreCase } from '@renderer/utils/includes'
import { HiSortAscending, HiSortDescending } from 'react-icons/hi'
import { IoApps, IoList, IoGrid, IoEye, IoEyeOff, IoPause, IoPlay, IoAddCircleOutline, IoPulseOutline, IoTimeOutline } from 'react-icons/io5'

import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { MdTune } from 'react-icons/md'
import { IoLink } from 'react-icons/io5'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { CustomContextMenu } from '@renderer/components/ui/custom-context-menu'
import { useConnectionsStore } from '@renderer/store/use-connections-store'
import { useResourceQueue } from '@renderer/hooks/use-resource-queue'

const Connections: React.FC = () => {
  const { controledMihomoConfig } = useControledMihomoConfig()
  const { 'find-process-mode': findProcessMode = 'always' } = controledMihomoConfig || {}
  const [filter, setFilter] = useState('')
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    connectionDirection = 'asc',
    connectionOrderBy = 'time',
    displayIcon = true,
    displayAppName = true
  } = appConfig || {}

  // Use Global Store directly
  const activeConnections = useConnectionsStore((state) => state.activeConnections)
  const closedConnections = useConnectionsStore((state) => state.closedConnections)
  const trashClosedConnection = useConnectionsStore((state) => state.trashClosedConnection)
  const trashAllClosedConnections = useConnectionsStore((state) => state.trashAllClosedConnections)
  const isPaused = useConnectionsStore((state) => state.isPaused)
  const setPaused = useConnectionsStore((state) => state.setPaused)

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isSettingModalOpen, setIsSettingModalOpen] = useState(false)
  const [isCreateRuleModalOpen, setIsCreateRuleModalOpen] = useState(false)
  const [selected, setSelected] = useState<ControllerConnectionDetail>()
  const [createRuleConnection, setCreateRuleConnection] = useState<ControllerConnectionDetail>()

  const [tab, setTab] = useState('active')
  const [viewMode, setViewMode] = useState<'list' | 'group' | 'table'>('list')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  
  // Local deleted IDs just for UI feedback if needed, strictly not required if store handles it immediately.
  // usage: filteredConnections checking deletedIds.
  // Since store handles deletion (trashClosedConnection), we might relying on store update.
  // But let's keep `deletedIds` if we want instant optimistic UI removal before store updates?
  // Store update is sync for `trashClosedConnection`, so no need for local deletedIds for closed.
  // For active, we call IPC close, which is async. We might want `deletedIds` for active.
  
  // ... hidden rules ...
  const [hiddenRules, setHiddenRules] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('hiddenConnectionRules')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })
  const [showHidden, setShowHidden] = useState(false) // 是否显示隐藏的连接

  const [timeRefreshTrigger, setTimeRefreshTrigger] = useState(0) // 统一时间刷新触发器
  
  // 使用防抖值处理用户的输入或者频繁变动的排序依据，使其脱离高频的主更新渲染流水线
  const deferredFilter = useDeferredValue(filter)
  const deferredOrder = useDeferredValue(connectionOrderBy)
  const deferredDirection = useDeferredValue(connectionDirection)

  const filteredConnections = useMemo(() => {
    const connections = tab === 'active' ? activeConnections : closedConnections

    let filtered = connections
    
    // 过滤隐藏的连接（除非用户选择显示隐藏的连接）
    if (!showHidden && hiddenRules.size > 0) {
      filtered = filtered.filter(conn => {
        const rule = `${conn.metadata.process || 'unknown'}:${conn.metadata.host || conn.metadata.destinationIP || 'unknown'}`
        return !hiddenRules.has(rule)
      })
    }
    
    if (deferredFilter !== '') {
      filtered = filtered.filter((connection) => {
        const searchableFields = [
          connection.metadata.process,
          connection.metadata.host,
          connection.metadata.destinationIP,
          connection.metadata.sourceIP,
          connection.chains?.[0],
          connection.rule,
          connection.rulePayload
        ]
          .filter(Boolean)
          .join(' ')

        return includesIgnoreCase(searchableFields, deferredFilter)
      })
    }

    if (deferredOrder) {
      filtered = [...filtered].sort((a, b) => {
        const dir = deferredDirection === 'asc' ? 1 : -1
        switch (deferredOrder) {
          case 'time':
            return dir * (dayjs(b.start).unix() - dayjs(a.start).unix())
          case 'upload':
            return dir * (a.upload - b.upload)
          case 'download':
            return dir * (a.download - b.download)
          case 'uploadSpeed':
            return dir * ((a.uploadSpeed || 0) - (b.uploadSpeed || 0))
          case 'downloadSpeed':
            return dir * ((a.downloadSpeed || 0) - (b.downloadSpeed || 0))
          case 'process':
            return dir * (a.metadata.process || '').localeCompare(b.metadata.process || '')
          case 'type':
            return dir * `${a.metadata.type}|${a.metadata.network}`.localeCompare(`${b.metadata.type}|${b.metadata.network}`)
          case 'rule':
            return dir * (a.rule || '').localeCompare(b.rule || '')
          default:
            return 0
        }
      })
    }

    return filtered
  }, [activeConnections, closedConnections, deferredFilter, deferredDirection, deferredOrder, tab, hiddenRules, showHidden])

  // 按进程分组
  const groupedConnections = useMemo(() => {
    const groups = new Map<string, {
      process: string
      processPath: string
      connections: ControllerConnectionDetail[]
      totalUpload: number
      totalDownload: number
      uploadSpeed: number
      downloadSpeed: number
    }>()

    filteredConnections.forEach(conn => {
      const process = conn.metadata.process || '未知进程'
      const processPath = conn.metadata.processPath || ''
      
      if (!groups.has(process)) {
        groups.set(process, {
          process,
          processPath,
          connections: [],
          totalUpload: 0,
          totalDownload: 0,
          uploadSpeed: 0,
          downloadSpeed: 0
        })
      }
      
      const group = groups.get(process)!
      group.connections.push(conn)
      group.totalUpload += conn.upload
      group.totalDownload += conn.download
      group.uploadSpeed += conn.uploadSpeed || 0
      group.downloadSpeed += conn.downloadSpeed || 0
    })

    // 按连接数排序
    return Array.from(groups.values()).sort((a, b) => b.connections.length - a.connections.length)
  }, [filteredConnections])

  const closeAllConnections = useCallback((): void => {
    tab === 'active' ? mihomoCloseAllConnections() : trashAllClosedConnections()
  }, [tab, trashAllClosedConnections])

  // 建立 O(1) 连接 ID 索引，避免 hideConnection / unhideConnection 每次合并数组再线性查找
  const connectionMap = useMemo(() => {
    const map = new Map<string, ControllerConnectionDetail>()
    for (const c of activeConnections) map.set(c.id, c)
    for (const c of closedConnections) map.set(c.id, c)
    return map
  }, [activeConnections, closedConnections])

  const closeConnection = useCallback(
    (id: string): void => {
      tab === 'active' ? mihomoCloseConnection(id) : trashClosedConnection(id)
    },
    [tab, trashClosedConnection]
  )

  const hideConnection = useCallback((id: string) => {
    const conn = connectionMap.get(id)
    if (!conn) return
    
    const rule = `${conn.metadata.process || 'unknown'}:${conn.metadata.host || conn.metadata.destinationIP || 'unknown'}`
    setHiddenRules((prev) => {
      const newSet = new Set([...prev, rule])
      localStorage.setItem('hiddenConnectionRules', JSON.stringify(Array.from(newSet)))
      return newSet
    })
  }, [connectionMap])

  const unhideConnection = useCallback((id: string) => {
    const conn = connectionMap.get(id)
    if (!conn) return
    
    const rule = `${conn.metadata.process || 'unknown'}:${conn.metadata.host || conn.metadata.destinationIP || 'unknown'}`
    setHiddenRules((prev) => {
      const newSet = new Set(prev)
      newSet.delete(rule)
      localStorage.setItem('hiddenConnectionRules', JSON.stringify(Array.from(newSet)))
      return newSet
    })
  }, [connectionMap])

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{ isOpen: boolean; x: number; y: number; conn?: ControllerConnectionDetail }>({ isOpen: false, x: 0, y: 0 })

  const handleContextMenu = useCallback((conn: ControllerConnectionDetail, e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY, conn })
  }, [])

  const handleCreateRule = useCallback((conn: ControllerConnectionDetail) => {
    setCreateRuleConnection(conn)
    setIsCreateRuleModalOpen(true)
  }, [])

  const clearAllHidden = useCallback((): void => {
    setHiddenRules(new Set())
    localStorage.removeItem('hiddenConnectionRules')
  }, [])
  
  // Use the new hook
  const {
    iconMap,
    appNameCache,
    firstItemRefreshTrigger,
    loadIcon,
    loadAppName
  } = useResourceQueue(
    displayIcon,
    displayAppName,
    findProcessMode,
    filteredConnections[0]?.metadata?.processPath
  )

  useEffect(() => {
    if (!displayIcon || findProcessMode === 'off') return

    const visiblePaths = new Set<string>()
    const otherPaths = new Set<string>()

    const visibleConnections = filteredConnections.slice(0, 20)
    visibleConnections.forEach((c) => {
      const path = c.metadata.processPath || ''
      visiblePaths.add(path)
    })

    const collectPaths = (connections: ControllerConnectionDetail[]) => {
      for (const c of connections) {
        const path = c.metadata.processPath || ''
        if (!visiblePaths.has(path)) {
          otherPaths.add(path)
        }
      }
    }

    collectPaths(activeConnections)
    collectPaths(closedConnections)

    visiblePaths.forEach((path) => {
      loadIcon(path, true)
      if (displayAppName) loadAppName(path)
    })

    if (otherPaths.size > 0) {
      const loadOtherPaths = () => {
        otherPaths.forEach((path) => {
          loadIcon(path, false)
          if (displayAppName) loadAppName(path)
        })
      }

      setTimeout(loadOtherPaths, 100)
    }
  }, [
    activeConnections,
    closedConnections,
    displayIcon,
    filteredConnections,
    loadIcon,
    loadAppName,
    displayAppName,
    findProcessMode
  ])

  // 统一时间刷新定时器（每60秒触发一次，替代每个卡片的独立定时器）
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRefreshTrigger(prev => prev + 1)
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  const handleTabChange = useCallback((key: Key) => {
    setTab(key as string)
  }, [])

  const handleOrderByChange = useCallback(
    async (v: unknown) => {
      await patchAppConfig({
        connectionOrderBy: (v as { currentKey: string }).currentKey as
          | 'time'
          | 'upload'
          | 'download'
          | 'uploadSpeed'
          | 'downloadSpeed'
          | 'process'
          | 'type'
          | 'rule'
      })
    },
    [patchAppConfig]
  )

  const handleDirectionToggle = useCallback(async () => {
    await patchAppConfig({
      connectionDirection: connectionDirection === 'asc' ? 'desc' : 'asc'
    })
  }, [connectionDirection, patchAppConfig])

  const toggleGroup = useCallback((process: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(process)) {
        next.delete(process)
      } else {
        next.add(process)
      }
      return next
    })
  }, [])

  const renderConnectionItem = useCallback(
    (i: number, connection: ControllerConnectionDetail) => {
      const path = connection.metadata.processPath || ''
      const iconUrl = (displayIcon && findProcessMode !== 'off' && iconMap[path]) || ''
      const itemKey = i === 0 ? `${connection.id}-${firstItemRefreshTrigger}` : connection.id
      const displayName =
        displayAppName && connection.metadata.processPath
          ? appNameCache[connection.metadata.processPath]
          : undefined

      return (
        <ConnectionItem
          setSelected={setSelected}
          setIsDetailModalOpen={setIsDetailModalOpen}
          selected={selected}
          iconUrl={iconUrl}
          displayIcon={displayIcon && findProcessMode !== 'off'}
          displayName={displayName}
          close={closeConnection}
          hide={hideConnection}
          unhide={unhideConnection}
          isHidden={hiddenRules.has(`${connection.metadata.process || 'unknown'}:${connection.metadata.host || connection.metadata.destinationIP || 'unknown'}`)}
          index={i}
          key={itemKey}
          info={connection}
          timeRefreshTrigger={timeRefreshTrigger}
          onContextMenu={handleContextMenu}
        />
      )
    },
    [
      displayIcon,
      iconMap,
      firstItemRefreshTrigger,
      selected,
      closeConnection,
      hideConnection,
      unhideConnection,
      hiddenRules,
      appNameCache,
      findProcessMode,
      displayAppName,
      timeRefreshTrigger,
      handleContextMenu
    ]
  )

  return (
    <BasePage
      title="连接"
      header={
        <Button
          size="sm"
          isIconOnly
          className="app-nodrag"
          variant="light"
          title="连接设置"
          onPress={() => setIsSettingModalOpen(true)}
        >
          <MdTune className="text-lg" />
        </Button>
      }
    >
      {isDetailModalOpen && selected && (
        <ConnectionDetailModal 
          onClose={() => setIsDetailModalOpen(false)} 
          connection={selected} 
          onDisconnect={tab === 'active' ? (id) => { closeConnection(id); setIsDetailModalOpen(false) } : undefined}
        />
      )}
      {isCreateRuleModalOpen && createRuleConnection && (
        <CreateRuleModal
          connection={createRuleConnection}
          onClose={() => setIsCreateRuleModalOpen(false)}
        />
      )}
      {contextMenu.isOpen && (
        <CustomContextMenu
          isOpen={contextMenu.isOpen}
          onClose={() => setContextMenu(prev => ({ ...prev, isOpen: false }))}
          position={{ x: contextMenu.x, y: contextMenu.y }}
        >
          <div className="flex flex-col">
            <Button
               size="sm"
               variant="light"
               className="w-full justify-start h-9 px-3 min-w-[140px] font-medium text-default-700 gap-2"
               startContent={<IoAddCircleOutline className="text-lg text-primary" />}
               onPress={() => {
                 if (contextMenu.conn) {
                   handleCreateRule(contextMenu.conn)
                   setContextMenu(prev => ({ ...prev, isOpen: false }))
                 }
               }}
            >
              新建规则
            </Button>
          </div>
        </CustomContextMenu>
      )}
      {isSettingModalOpen && (
        <ConnectionSettingModal onClose={() => setIsSettingModalOpen(false)} />
      )}
      {isPaused && (
        <div className="sticky top-0 z-50 bg-warning/10 border-b border-warning/30 px-4 py-2 flex items-center justify-center gap-2">
          <IoPause className="text-warning text-sm" />
          <span className="text-xs text-warning font-medium">连接列表已暂停刷新</span>
        </div>
      )}
      <div className="overflow-x-auto sticky top-0 z-40 w-full pb-2 px-2 pt-2 pointer-events-none">
        <div className={`flex items-center w-full px-2 py-1.5 gap-2 pointer-events-auto ${CARD_STYLES.GLASS_TOOLBAR} ${CARD_STYLES.ROUNDED}`}>
          <Tabs
            size="md"
            variant="solid"
            radius="lg"
            selectedKey={tab}
            onSelectionChange={handleTabChange}
            classNames={CARD_STYLES.GLASS_TABS}
          >
            <Tab
              key="active"
              title={
                <div className="flex items-center gap-2 px-2">
                  <IoPulseOutline className="text-lg" />
                  <span>活动中</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-success/15 text-success leading-none">
                    {activeConnections.length}
                  </span>
                </div>
              }
            />
            <Tab
              key="closed"
              title={
                <div className="flex items-center gap-2 px-2">
                  <IoTimeOutline className="text-lg" />
                  <span>已关闭</span>
                  {closedConnections.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-default-400/15 text-default-500 leading-none">
                      {closedConnections.length}
                    </span>
                  )}
                </div>
              }
            />
          </Tabs>
          <Input
            variant="flat"
            size="sm"
            className="min-w-[120px] flex-1"
            classNames={CARD_STYLES.GLASS_INPUT}
            value={filter}
            placeholder="筛选过滤"
            isClearable
            onValueChange={setFilter}
          />

          <Select
            classNames={CARD_STYLES.GLASS_SELECT}
            size="sm"
            className="w-[110px] min-w-[110px]"
            selectedKeys={new Set([connectionOrderBy])}
            disallowEmptySelection={true}
            onSelectionChange={handleOrderByChange}
          >
            <SelectItem key="upload">上传量</SelectItem>
            <SelectItem key="download">下载量</SelectItem>
            <SelectItem key="uploadSpeed">上传速度</SelectItem>
            <SelectItem key="downloadSpeed">下载速度</SelectItem>
            <SelectItem key="time">时间</SelectItem>
            <SelectItem key="process">进程名称</SelectItem>
            <SelectItem key="type">类型</SelectItem>
            <SelectItem key="rule">规则</SelectItem>
          </Select>
          <Button size="sm" isIconOnly className="bg-content2" onPress={handleDirectionToggle}>
            {connectionDirection === 'asc' ? (
              <HiSortAscending className="text-lg" />
            ) : (
              <HiSortDescending className="text-lg" />
            )}
          </Button>
          <Dropdown>
            <DropdownTrigger>
              <Button 
                size="sm" 
                isIconOnly 
                className="bg-content2"
              >
                {viewMode === 'table' ? <IoGrid className="text-lg" /> : 
                 viewMode === 'list' ? <IoList className="text-lg" /> : 
                 <IoApps className="text-lg" />}
              </Button>
            </DropdownTrigger>
            <DropdownMenu 
              aria-label="视图切换"
              selectionMode="single"
              selectedKeys={new Set([viewMode])}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as 'table' | 'list' | 'group'
                if (selected) setViewMode(selected)
              }}
            >
              <DropdownItem key="list" startContent={<IoList />}>卡片视图</DropdownItem>
              <DropdownItem key="table" startContent={<IoGrid />}>表格视图</DropdownItem>
              <DropdownItem key="group" startContent={<IoApps />}>分组视图</DropdownItem>
            </DropdownMenu>
          </Dropdown>
          <Button
            size="sm"
            isIconOnly
            variant="flat"
            color={isPaused ? 'success' : 'warning'}
            title={isPaused ? '继续刷新' : '暂停刷新'}
            onPress={() => setPaused(!isPaused)}
          >
            {isPaused ? <IoPlay className="text-lg" /> : <IoPause className="text-lg" />}
          </Button>
          <Button
            size="sm"
            isIconOnly
            variant="flat"
            color="danger"
            title={tab === 'active' ? '关闭全部' : '清空记录'}
            onPress={() => {
              if (filter === '') {
                closeAllConnections()
              } else {
                filteredConnections.forEach((conn) => {
                  closeConnection(conn.id)
                })
              }
            }}
          >
            {tab === 'active' ? <CgClose className="text-lg" /> : <CgTrash className="text-lg" />}
          </Button>
          {hiddenRules.size > 0 && (
            <>
              <Button
                size="sm"
                isIconOnly
                variant="flat"
                color={showHidden ? 'primary' : 'default'}
                title={showHidden ? `隐藏已隐藏的连接 (${hiddenRules.size} 规则)` : `显示已隐藏的连接 (${hiddenRules.size} 规则)`}
                onPress={() => setShowHidden(!showHidden)}
              >
                {showHidden ? <IoEye className="text-lg" /> : <IoEyeOff className="text-lg" />}
              </Button>
              <Button
                size="sm"
                isIconOnly
                variant="flat"
                color="warning"
                title="清除所有隐藏"
                onPress={clearAllHidden}
              >
                <CgTrash className="text-lg" />
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="h-[calc(100vh-100px)] overflow-y-auto">
        {filteredConnections.length === 0 ? (
          <EmptyState
            icon={<IoLink />}
            title={tab === 'active' ? '暂无活动连接' : '暂无已关闭连接'}
            description="连接信息将在这里显示"
          />
        ) : viewMode === 'table' ? (
            <ConnectionTable
            connections={filteredConnections}
            selected={selected}
            setSelected={setSelected}
            setIsDetailModalOpen={setIsDetailModalOpen}
            close={closeConnection}
            iconMap={iconMap}
            appNameCache={appNameCache}
            displayIcon={displayIcon && findProcessMode !== 'off'}
            displayAppName={displayAppName}
            sortBy={connectionOrderBy === 'time' ? 'time' : 
                    connectionOrderBy === 'upload' ? 'upload' :
                    connectionOrderBy === 'download' ? 'download' :
                    connectionOrderBy === 'uploadSpeed' ? 'uploadSpeed' :
                    connectionOrderBy === 'downloadSpeed' ? 'downloadSpeed' :
                    connectionOrderBy === 'process' ? 'process' :
                    connectionOrderBy === 'type' ? 'type' :
                    connectionOrderBy === 'rule' ? 'rule' : undefined}
            sortDirection={connectionDirection}
            onSort={(col) => {
              const columnToOrderBy: Record<string, string> = {
                time: 'time',
                upload: 'upload',
                download: 'download',
                uploadSpeed: 'uploadSpeed',
                downloadSpeed: 'downloadSpeed',
                process: 'process',
                type: 'type',
                rule: 'rule'
              }
              const orderBy = columnToOrderBy[col]
              if (orderBy) {
                if (connectionOrderBy === orderBy) {
                  patchAppConfig({ connectionDirection: connectionDirection === 'asc' ? 'desc' : 'asc' })
                } else {
                  patchAppConfig({ connectionOrderBy: orderBy as 'time' | 'upload' | 'download' | 'uploadSpeed' | 'downloadSpeed' | 'process' | 'type' | 'rule' })
                }
              }
            }}
            onContextMenu={handleContextMenu}
          />
        ) : viewMode === 'list' ? (
          <Virtuoso data={filteredConnections} itemContent={renderConnectionItem} />
        ) : (
          <ConnectionsGroupView
            groupedConnections={groupedConnections}
            expandedGroups={expandedGroups}
            toggleGroup={toggleGroup}
            displayIcon={displayIcon}
            displayAppName={displayAppName}
            findProcessMode={findProcessMode}
            iconMap={iconMap}
            appNameCache={appNameCache}
            tab={tab}
            selected={selected}
            setSelected={setSelected}
            setIsDetailModalOpen={setIsDetailModalOpen}
            closeConnection={closeConnection}
            hideConnection={hideConnection}
            unhideConnection={unhideConnection}
            hiddenRules={hiddenRules}
            handleContextMenu={handleContextMenu}
          />
        )}
      </div>
    </BasePage>
  )
}

export default Connections
