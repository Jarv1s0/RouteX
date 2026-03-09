import BasePage from '@renderer/components/base/base-page'
import EmptyState from '@renderer/components/base/empty-state'
import { mihomoCloseAllConnections, mihomoCloseConnection } from '@renderer/utils/ipc'
import React, { Key, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Input, Select, SelectItem, Tab, Tabs, Chip, Card, CardHeader, CardFooter, Avatar, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@heroui/react'
import { calcTraffic } from '@renderer/utils/calc'
import ConnectionItem from '@renderer/components/connections/connection-item'
import ConnectionTable from '@renderer/components/connections/connection-table'
import { Virtuoso } from 'react-virtuoso'
import dayjs from 'dayjs'
import ConnectionDetailModal from '@renderer/components/connections/connection-detail-modal'
import ConnectionSettingModal from '@renderer/components/connections/connection-setting-modal'
import { CgClose, CgTrash } from 'react-icons/cg'
import { IoPulseOutline, IoTimeOutline } from 'react-icons/io5'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { includesIgnoreCase } from '@renderer/utils/includes'
import { getIconDataURL, getAppName } from '@renderer/utils/ipc'
import { HiSortAscending, HiSortDescending } from 'react-icons/hi'
import { IoApps, IoList, IoGrid, IoEye, IoEyeOff, IoPause, IoPlay } from 'react-icons/io5'
import { cropAndPadTransparent } from '@renderer/utils/image'
import { platform } from '@renderer/utils/init'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { MdTune } from 'react-icons/md'
import { IoLink } from 'react-icons/io5'
import { CARD_STYLES } from '@renderer/utils/card-styles'

let cachedConnections: ControllerConnectionDetail[] = []

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
  const [allConnections, setAllConnections] =
    useState<ControllerConnectionDetail[]>(cachedConnections)
  const [activeConnections, setActiveConnections] = useState<ControllerConnectionDetail[]>([])
  const [closedConnections, setClosedConnections] = useState<ControllerConnectionDetail[]>([])
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isSettingModalOpen, setIsSettingModalOpen] = useState(false)
  const [selected, setSelected] = useState<ControllerConnectionDetail>()

  const [iconMap, setIconMap] = useState<Record<string, string>>({})
  const [appNameCache, setAppNameCache] = useState<Record<string, string>>({})
  const [firstItemRefreshTrigger, setFirstItemRefreshTrigger] = useState(0)

  const [tab, setTab] = useState('active')
  const [viewMode, setViewMode] = useState<'list' | 'group' | 'table'>('list')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  
  // 从 localStorage 加载隐藏规则
  const [hiddenRules, setHiddenRules] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('hiddenConnectionRules')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })
  const [showHidden, setShowHidden] = useState(false) // 是否显示隐藏的连接
  const [isPaused, setIsPaused] = useState(false) // 是否暂停刷新
  const [timeRefreshTrigger, setTimeRefreshTrigger] = useState(0) // 统一时间刷新触发器

  const iconRequestQueue = useRef(new Set<string>())
  const processingIcons = useRef(new Set<string>())
  const processIconTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const appNameRequestQueue = useRef(new Set<string>())
  const processingAppNames = useRef(new Set<string>())
  const processAppNameTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    
    if (filter !== '') {
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

        return includesIgnoreCase(searchableFields, filter)
      })
    }

    if (connectionOrderBy) {
      filtered = [...filtered].sort((a, b) => {
        if (connectionDirection === 'asc') {
          switch (connectionOrderBy) {
            case 'time':
              return dayjs(b.start).unix() - dayjs(a.start).unix()
            case 'upload':
              return a.upload - b.upload
            case 'download':
              return a.download - b.download
            case 'uploadSpeed':
              return (a.uploadSpeed || 0) - (b.uploadSpeed || 0)
            case 'downloadSpeed':
              return (a.downloadSpeed || 0) - (b.downloadSpeed || 0)
            case 'process':
              return (a.metadata.process || '').localeCompare(b.metadata.process || '')
            case 'type':
              return `${a.metadata.type}|${a.metadata.network}`.localeCompare(`${b.metadata.type}|${b.metadata.network}`)
            case 'rule':
              return (a.rule || '').localeCompare(b.rule || '')
          }
        } else {
          switch (connectionOrderBy) {
            case 'time':
              return dayjs(a.start).unix() - dayjs(b.start).unix()
            case 'upload':
              return b.upload - a.upload
            case 'download':
              return b.download - a.download
            case 'uploadSpeed':
              return (b.uploadSpeed || 0) - (a.uploadSpeed || 0)
            case 'downloadSpeed':
              return (b.downloadSpeed || 0) - (a.downloadSpeed || 0)
            case 'process':
              return (b.metadata.process || '').localeCompare(a.metadata.process || '')
            case 'type':
              return `${b.metadata.type}|${b.metadata.network}`.localeCompare(`${a.metadata.type}|${a.metadata.network}`)
            case 'rule':
              return (b.rule || '').localeCompare(a.rule || '')
          }
        }
      })
    }

    return filtered
  }, [activeConnections, closedConnections, filter, connectionDirection, connectionOrderBy, tab, hiddenRules, showHidden])

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

  const trashAllClosedConnection = useCallback((): void => {
    if (closedConnections.length === 0) return

    const trashIds = closedConnections.map((conn) => conn.id)
    setDeletedIds((prev) => new Set([...prev, ...trashIds]))
    setAllConnections((allConns) => {
      const updatedConnections = allConns.filter((conn) => !trashIds.includes(conn.id))
      cachedConnections = updatedConnections
      return updatedConnections
    })
    setClosedConnections([])
  }, [closedConnections])

  const trashClosedConnection = useCallback((id: string): void => {
    setDeletedIds((prev) => new Set([...prev, id]))
    setAllConnections((allConns) => {
      const updatedConnections = allConns.filter((conn) => conn.id !== id)
      cachedConnections = updatedConnections
      return updatedConnections
    })
    setClosedConnections((closedConns) => closedConns.filter((conn) => conn.id !== id))
  }, [])

  const closeAllConnections = useCallback((): void => {
    tab === 'active' ? mihomoCloseAllConnections() : trashAllClosedConnection()
  }, [tab, trashAllClosedConnection])

  const closeConnection = useCallback(
    (id: string): void => {
      tab === 'active' ? mihomoCloseConnection(id) : trashClosedConnection(id)
    },
    [tab, trashClosedConnection]
  )

  const hideConnection = useCallback((id: string) => {
    const conn = [...activeConnections, ...closedConnections].find(c => c.id === id)
    if (!conn) return
    
    const rule = `${conn.metadata.process || 'unknown'}:${conn.metadata.host || conn.metadata.destinationIP || 'unknown'}`
    setHiddenRules((prev) => {
      const newSet = new Set([...prev, rule])
      localStorage.setItem('hiddenConnectionRules', JSON.stringify(Array.from(newSet)))
      return newSet
    })
  }, [activeConnections, closedConnections])

  const unhideConnection = useCallback((id: string) => {
    const conn = [...activeConnections, ...closedConnections].find(c => c.id === id)
    if (!conn) return
    
    const rule = `${conn.metadata.process || 'unknown'}:${conn.metadata.host || conn.metadata.destinationIP || 'unknown'}`
    setHiddenRules((prev) => {
      const newSet = new Set(prev)
      newSet.delete(rule)
      localStorage.setItem('hiddenConnectionRules', JSON.stringify(Array.from(newSet)))
      return newSet
    })
  }, [activeConnections, closedConnections])

  const clearAllHidden = useCallback((): void => {
    setHiddenRules(new Set())
    localStorage.removeItem('hiddenConnectionRules')
  }, [])

  useEffect(() => {
    const handleConnections = (_e: unknown, info: ControllerConnections): void => {
      if (!info.connections) return
      if (isPaused) return // 暂停时不更新连接列表

      const prevActiveMap = new Map(activeConnections.map((conn) => [conn.id, conn]))
      const existingConnectionIds = new Set(allConnections.map((conn) => conn.id))

      const activeConns = info.connections.map((conn) => {
        const preConn = prevActiveMap.get(conn.id)
        const downloadSpeed = preConn ? conn.download - preConn.download : 0
        const uploadSpeed = preConn ? conn.upload - preConn.upload : 0
        const metadata =
          conn.metadata.type === 'Inner'
            ? { ...conn.metadata, process: 'mihomo', processPath: 'mihomo' }
            : conn.metadata

        return {
          ...conn,
          metadata,
          isActive: true,
          downloadSpeed,
          uploadSpeed
        }
      })

      const newConnections = activeConns.filter(
        (conn) => !existingConnectionIds.has(conn.id) && !deletedIds.has(conn.id)
      )

      if (newConnections.length > 0) {
        const updatedAllConnections = [...allConnections, ...newConnections]

        const activeConnIds = new Set(activeConns.map((conn) => conn.id))
        const allConns = updatedAllConnections.map((conn) => {
          const activeConn = activeConns.find((ac) => ac.id === conn.id)
          return activeConn || { ...conn, isActive: false, downloadSpeed: 0, uploadSpeed: 0 }
        })

        const closedConns = allConns.filter((conn) => !activeConnIds.has(conn.id))

        setActiveConnections(activeConns)
        setClosedConnections(closedConns)
        const finalAllConnections = allConns.slice(-(activeConns.length + 200))
        setAllConnections(finalAllConnections)
        cachedConnections = finalAllConnections
      } else {
        const activeConnIds = new Set(activeConns.map((conn) => conn.id))
        const allConns = allConnections.map((conn) => {
          const activeConn = activeConns.find((ac) => ac.id === conn.id)
          return activeConn || { ...conn, isActive: false, downloadSpeed: 0, uploadSpeed: 0 }
        })

        const closedConns = allConns.filter((conn) => !activeConnIds.has(conn.id))

        setActiveConnections(activeConns)
        setClosedConnections(closedConns)
        setAllConnections(allConns)
        cachedConnections = allConns
      }
    }

    window.electron.ipcRenderer.on('mihomoConnections', handleConnections)

    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('mihomoConnections')
    }
  }, [allConnections, activeConnections, closedConnections, deletedIds, isPaused])

  const processAppNameQueue = useCallback(async () => {
    if (processingAppNames.current.size >= 3 || appNameRequestQueue.current.size === 0) return

    const pathsToProcess = Array.from(appNameRequestQueue.current).slice(0, 3)
    pathsToProcess.forEach((path) => appNameRequestQueue.current.delete(path))

    const promises = pathsToProcess.map(async (path) => {
      if (processingAppNames.current.has(path)) return
      processingAppNames.current.add(path)

      try {
        const appName = await getAppName(path)
        if (appName) {
          setAppNameCache((prev) => ({ ...prev, [path]: appName }))
        }
      } catch {
        // ignore
      } finally {
        processingAppNames.current.delete(path)
      }
    })

    await Promise.all(promises)

    if (appNameRequestQueue.current.size > 0) {
      processAppNameTimer.current = setTimeout(processAppNameQueue, 100)
    }
  }, [])

  const processIconQueue = useCallback(async () => {
    if (processingIcons.current.size >= 5 || iconRequestQueue.current.size === 0) return

    const pathsToProcess = Array.from(iconRequestQueue.current).slice(0, 5)
    pathsToProcess.forEach((path) => iconRequestQueue.current.delete(path))

    const promises = pathsToProcess.map(async (path) => {
      if (processingIcons.current.has(path)) return
      processingIcons.current.add(path)

      try {
        const rawBase64 = await getIconDataURL(path)
        if (!rawBase64) return

        const fullDataURL = rawBase64.startsWith('data:')
          ? rawBase64
          : `data:image/png;base64,${rawBase64}`

        let processedDataURL = fullDataURL
        if (platform != 'darwin') {
          processedDataURL = await cropAndPadTransparent(fullDataURL)
        }

        try {
          localStorage.setItem(path, processedDataURL)
        } catch {
          // ignore
        }

        setIconMap((prev) => ({ ...prev, [path]: processedDataURL }))

        const firstConnection = filteredConnections[0]
        if (firstConnection?.metadata.processPath === path) {
          setFirstItemRefreshTrigger((prev) => prev + 1)
        }
      } catch {
        // ignore
      } finally {
        processingIcons.current.delete(path)
      }
    })

    await Promise.all(promises)

    if (iconRequestQueue.current.size > 0) {
      processIconTimer.current = setTimeout(processIconQueue, 50)
    }
  }, [filteredConnections])

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

    const loadIcon = (path: string, isVisible: boolean = false): void => {
      if (iconMap[path] || processingIcons.current.has(path)) return

      const fromStorage = localStorage.getItem(path)
      if (fromStorage) {
        setIconMap((prev) => ({ ...prev, [path]: fromStorage }))
        if (isVisible && filteredConnections[0]?.metadata.processPath === path) {
          setFirstItemRefreshTrigger((prev) => prev + 1)
        }
        return
      }

      iconRequestQueue.current.add(path)
    }

    const loadAppName = (path: string): void => {
      if (appNameCache[path] || processingAppNames.current.has(path)) return
      appNameRequestQueue.current.add(path)
    }

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

    if (processIconTimer.current) clearTimeout(processIconTimer.current)
    if (processAppNameTimer.current) clearTimeout(processAppNameTimer.current)

    processIconTimer.current = setTimeout(processIconQueue, 10)
    if (displayAppName) {
      processAppNameTimer.current = setTimeout(processAppNameQueue, 10)
    }

    return (): void => {
      if (processIconTimer.current) clearTimeout(processIconTimer.current)
      if (processAppNameTimer.current) clearTimeout(processAppNameTimer.current)
    }
  }, [
    activeConnections,
    closedConnections,
    iconMap,
    appNameCache,
    displayIcon,
    filteredConnections,
    processIconQueue,
    processAppNameQueue,
    displayAppName
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
      timeRefreshTrigger
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
        <ConnectionDetailModal onClose={() => setIsDetailModalOpen(false)} connection={selected} />
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
                  <span>活动中 ({activeConnections.length})</span>
                </div>
              }
            />
            <Tab
              key="closed"
              title={
                <div className="flex items-center gap-2 px-2">
                  <IoTimeOutline className="text-lg" />
                  <span>已关闭 ({closedConnections.length})</span>
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
            onPress={() => setIsPaused(!isPaused)}
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
          />
        ) : viewMode === 'list' ? (
          <Virtuoso data={filteredConnections} itemContent={renderConnectionItem} />
        ) : (
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
                            <Chip
                              color="primary"
                              size="sm"
                              radius="sm"
                              variant="dot"
                            >
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
                          />
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </BasePage>
  )
}

export default Connections
