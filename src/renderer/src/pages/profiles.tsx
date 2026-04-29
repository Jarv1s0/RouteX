import {
  Button,
  Checkbox,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
  Tab,
  Tabs
} from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import ProfileItem from '@renderer/components/profiles/profile-item'
import ProxyProviderItem from '@renderer/components/profiles/proxy-provider-item'
import Viewer from '@renderer/components/resources/viewer'
import EditInfoModal from '@renderer/components/profiles/edit-info-modal'
import OverrideEditInfoModal from '@renderer/components/override/edit-info-modal'
import OverrideItemCard from '@renderer/components/override/override-item'
import { useProfileConfig } from '@renderer/hooks/use-profile-config'
import { getFilePath, readTextFile } from '@renderer/utils/file-ipc'
import { updateProfileItem } from '@renderer/utils/profile-ipc'
import {
  getRuntimeConfig,
  mihomoProxyProviders,
  mihomoUpdateProxyProviders
} from '@renderer/utils/mihomo-ipc'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { getHash } from '@renderer/utils/hash'
import { Virtuoso } from 'react-virtuoso'
import type { KeyboardEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MdContentPaste, MdTune } from 'react-icons/md'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { FaGithub, FaPlus } from 'react-icons/fa6'
import { IoMdRefresh } from 'react-icons/io'
import { LuFileText } from 'react-icons/lu'
import ProfileSettingModal from '@renderer/components/profiles/profile-setting-modal'
import useSWR from 'swr'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { notifyError } from '@renderer/utils/notify'
import { OverrideConfigProvider, useOverrideConfig } from '@renderer/hooks/use-override-config'
import { desktop } from '@renderer/api/desktop'
import { createQueuedCoreRestartRunner } from '@renderer/utils/core-restart'

const emptyProfileItems: ProfileItem[] = []
const emptyOverrideItems: OverrideItem[] = []

type ManagementTab = 'profiles' | 'overrides' | 'providers'

function dedupeProfileIds(ids: string[]): string[] {
  return Array.from(new Set(ids))
}

function resolveNextCurrentProfile(
  current: string | undefined,
  id: string,
  nextEnabled: boolean,
  nextActives: string[]
): string | undefined {
  if (nextEnabled || current !== id) {
    return current
  }
  return nextActives[0]
}

function normalizeManagementTab(tab: string | null): ManagementTab {
  if (tab === 'overrides' || tab === 'providers') {
    return tab
  }
  return 'profiles'
}

const ProfilesPage: React.FC = () => {
  const {
    profileConfig,
    setProfileConfig,
    addProfileItem,
    updateProfileItem: patchProfileItem,
    removeProfileItem,
    changeCurrentProfile,
    setActiveProfiles,
    mutateProfileConfig
  } = useProfileConfig()
  const {
    overrideConfig,
    setOverrideConfig,
    addOverrideItem,
    updateOverrideItem,
    removeOverrideItem,
    mutateOverrideConfig
  } = useOverrideConfig()
  const { current, items, actives } = profileConfig || {}
  const itemsArray = items ?? emptyProfileItems
  const activeProfileIds = useMemo(
    () => (actives && actives.length > 0 ? actives : current ? [current] : []),
    [actives, current]
  )
  const activeProfileIdSet = useMemo(() => new Set(activeProfileIds), [activeProfileIds])
  const currentProfile = useMemo(
    () => itemsArray.find((item) => item.id === current),
    [current, itemsArray]
  )
  const { items: overrideItems } = overrideConfig || {}
  const overrideItemsArray = overrideItems ?? emptyOverrideItems
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = normalizeManagementTab(searchParams.get('tab'))

  const [sortedItems, setSortedItems] = useState(itemsArray)
  const [sortedOverrideItems, setSortedOverrideItems] = useState(overrideItemsArray)
  const [providerUpdating, setProviderUpdating] = useState<boolean[]>([])
  const [showProviderDetails, setShowProviderDetails] = useState({
    show: false,
    path: '',
    type: '',
    title: '',
    privderType: ''
  })
  const shouldLoadProxyProviders = activeTab === 'providers'
  const { data: providersData, mutate: mutateProviders } = useSWR(
    shouldLoadProxyProviders ? 'mihomoProxyProviders' : null,
    mihomoProxyProviders,
    {
      errorRetryInterval: 200,
      errorRetryCount: 10,
      revalidateIfStale: false,
      revalidateOnMount: true
    }
  )
  const proxyProviders = useMemo(() => {
    if (!providersData) return []
    return Object.values(providersData.providers)
      .filter((provider) => provider.vehicleType !== 'Compatible')
      .sort((a, b) => {
        const order = { File: 1, Inline: 2, HTTP: 3 }
        return (order[a.vehicleType] || 4) - (order[b.vehicleType] || 4)
      })
  }, [providersData])

  useEffect(() => {
    setProviderUpdating(Array(proxyProviders.length).fill(false))
  }, [proxyProviders.length])

  useEffect(() => {
    if (!showProviderDetails.title) return

    const fetchProviderPath = async (name: string): Promise<void> => {
      try {
        const config = await getRuntimeConfig()
        const provider = config?.['proxy-providers']?.[name] as ProxyProviderConfig
        if (provider) {
          setShowProviderDetails((prev) => ({
            ...prev,
            show: true,
            path: provider.path || `proxies/${getHash(provider.url || '')}`
          }))
        }
      } catch {
        setShowProviderDetails((prev) => ({ ...prev, path: '' }))
      }
    }

    void fetchProviderPath(showProviderDetails.title)
  }, [showProviderDetails.title])

  const onProviderUpdate = async (name: string, index: number): Promise<void> => {
    setProviderUpdating((prev) => {
      const next = [...prev]
      next[index] = true
      return next
    })
    try {
      await mihomoUpdateProxyProviders(name)
      mutateProviders()
    } catch (e) {
      notifyError(`${name} 更新失败\n${e}`)
    } finally {
      setProviderUpdating((prev) => {
        const next = [...prev]
        next[index] = false
        return next
      })
    }
  }

  const updateAllProviders = (): void => {
    proxyProviders.forEach((provider, index) => {
      void onProviderUpdate(provider.name, index)
    })
  }

  const [useProxy, setUseProxy] = useState(false)
  const [importing, setImporting] = useState(false)
  const [overrideImporting, setOverrideImporting] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [fileOver, setFileOver] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showOverrideEditModal, setShowOverrideEditModal] = useState(false)
  const [isSettingModalOpen, setIsSettingModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ProfileItem | null>(null)
  const [editingOverrideItem, setEditingOverrideItem] = useState<OverrideItem | null>(null)
  const [url, setUrl] = useState('')
  const [overrideUrl, setOverrideUrl] = useState('')
  const isUrlEmpty = url.trim() === ''
  const isOverrideUrlEmpty = overrideUrl.trim() === ''
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 2
      }
    })
  )
  const handleTabChange = useCallback(
    (key: string) => {
      const nextTab = normalizeManagementTab(key)
      const nextParams = new URLSearchParams(searchParams)
      if (nextTab === 'profiles') {
        nextParams.delete('tab')
      } else {
        nextParams.set('tab', nextTab)
      }
      setSearchParams(nextParams, { replace: true })
    },
    [searchParams, setSearchParams]
  )

  const scheduleCoreRestart = useMemo(
    () => createQueuedCoreRestartRunner('应用覆写失败'),
    []
  )

  const handleImport = async (importUrl: string): Promise<void> => {
    setImporting(true)
    await addProfileItem({ name: '', type: 'remote', url: importUrl, useProxy, autoUpdate: true })
    setUrl('')
    setImporting(false)
  }

  const handleOverrideImport = useCallback(async () => {
    setOverrideImporting(true)
    try {
      const urlObj = new URL(overrideUrl)
      const name = urlObj.pathname.split('/').pop()
      await addOverrideItem({
        name: name ? decodeURIComponent(name) : undefined,
        type: 'remote',
        url: overrideUrl,
        ext: urlObj.pathname.endsWith('.js') ? 'js' : 'yaml'
      })
      setOverrideUrl('')
    } catch (e) {
      notifyError(e, { title: '导入远程覆写失败' })
    } finally {
      setOverrideImporting(false)
    }
  }, [addOverrideItem, overrideUrl])

  const onToggleOverride = useCallback(
    async (id: string, active: boolean): Promise<void> => {
      if (!currentProfile) return
      const currentOverrides = currentProfile.override || []
      let newOverride = currentOverrides
      if (active) {
        newOverride = newOverride.filter((overrideId) => overrideId !== id)
      } else if (!newOverride.includes(id)) {
        newOverride = [...newOverride, id]
      }

      if (
        newOverride.length === currentOverrides.length &&
        newOverride.every((overrideId, index) => overrideId === currentOverrides[index])
      ) {
        return
      }

      await updateProfileItem({ ...currentProfile, override: newOverride })
      mutateProfileConfig()
      scheduleCoreRestart()
    },
    [currentProfile, mutateProfileConfig, scheduleCoreRestart]
  )

  const pageRef = useRef<HTMLDivElement>(null)
  const isProcessingDrop = useRef(false)

  const onProfileDragEnd = async (event: DragEndEvent): Promise<void> => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const newOrder = sortedItems.slice()
    const activeIndex = newOrder.findIndex((item) => item.id === active.id)
    const overIndex = newOrder.findIndex((item) => item.id === over.id)
    newOrder.splice(activeIndex, 1)
    newOrder.splice(overIndex, 0, itemsArray[activeIndex])
    setSortedItems(newOrder)
    await setProfileConfig({ current, actives: activeProfileIds, items: newOrder })
  }

  const onOverrideDragEnd = async (event: DragEndEvent): Promise<void> => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const newOrder = sortedOverrideItems.slice()
    const activeIndex = newOrder.findIndex((item) => item.id === active.id)
    const overIndex = newOrder.findIndex((item) => item.id === over.id)
    newOrder.splice(activeIndex, 1)
    newOrder.splice(overIndex, 0, overrideItemsArray[activeIndex])
    setSortedOverrideItems(newOrder)
    await setOverrideConfig({ items: newOrder })
  }

  const handleProfileInputKeyUp = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter' || isUrlEmpty) return
      void handleImport((e.currentTarget as HTMLInputElement).value)
    },
    [isUrlEmpty]
  )

  const runSelectionMutation = useCallback(
    async (action: () => Promise<void>): Promise<void> => {
      setSwitching(true)
      try {
        await action()
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 500))
        setSwitching(false)
      }
    },
    []
  )

  const handleSetPrimaryProfile = useCallback(
    async (id: string): Promise<void> => {
      if (id === current) return
      await runSelectionMutation(() => changeCurrentProfile(id))
    },
    [changeCurrentProfile, current, runSelectionMutation]
  )

  const handleSwitchToStandaloneProfile = useCallback(
    async (id: string): Promise<void> => {
      if (current === id && activeProfileIds.length === 1) return
      await runSelectionMutation(() => setActiveProfiles([id], id))
    },
    [activeProfileIds.length, current, runSelectionMutation, setActiveProfiles]
  )

  const handleToggleProfileActive = useCallback(
    async (id: string, nextEnabled: boolean): Promise<void> => {
      const nextActives = nextEnabled
        ? dedupeProfileIds([...activeProfileIds, id])
        : activeProfileIds.filter((activeId) => activeId !== id)
      const nextCurrent = resolveNextCurrentProfile(current, id, nextEnabled, nextActives)

      await runSelectionMutation(() => setActiveProfiles(nextActives, nextCurrent))
    },
    [activeProfileIds, current, runSelectionMutation, setActiveProfiles]
  )

  const handleProfileCardClick = useCallback(
    async (id: string): Promise<void> => {
      if (id === current) return

      if (activeProfileIds.length <= 1) {
        await handleSwitchToStandaloneProfile(id)
        return
      }

      if (activeProfileIdSet.has(id)) {
        await handleSetPrimaryProfile(id)
        return
      }

      await handleToggleProfileActive(id, true)
    },
    [
      activeProfileIdSet,
      activeProfileIds.length,
      current,
      handleSetPrimaryProfile,
      handleSwitchToStandaloneProfile,
      handleToggleProfileActive
    ]
  )

  const handleOverrideInputKeyUp = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter' || isOverrideUrlEmpty) return
      void handleOverrideImport()
    },
    [handleOverrideImport, isOverrideUrlEmpty]
  )

  useEffect(() => {
    const pageElement = pageRef.current
    if (!pageElement) return

    const handleDragOver = (e: DragEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      setFileOver(true)
    }

    const handleDragLeave = (e: DragEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      setFileOver(false)
    }

    const handleDrop = async (event: DragEvent): Promise<void> => {
      event.preventDefault()
      event.stopPropagation()
      if (isProcessingDrop.current) return
      isProcessingDrop.current = true
      try {
        if (!event.dataTransfer?.files) return

        const file = event.dataTransfer.files[0]
        if (activeTab === 'overrides') {
          if (
            file.name.endsWith('.js') ||
            file.name.endsWith('.yml') ||
            file.name.endsWith('.yaml') ||
            file.name.endsWith('.json') ||
            file.name.endsWith('.jsonc') ||
            file.name.endsWith('.json5') ||
            file.name.endsWith('.txt')
          ) {
            try {
              const path = desktop.getPathForFile(file)
              const content = await readTextFile(path)
              await addOverrideItem({
                name: file.name,
                type: 'local',
                file: content,
                ext: file.name.endsWith('.js') ? 'js' : 'yaml'
              })
            } catch (e) {
              notifyError(`文件导入失败: ${e}`, { title: '导入失败' })
            }
          } else {
            notifyError('不支持的文件类型', { title: '导入失败' })
          }
          return
        }

        if (
          file.name.endsWith('.yml') ||
          file.name.endsWith('.yaml') ||
          file.name.endsWith('.json') ||
          file.name.endsWith('.jsonc') ||
          file.name.endsWith('.json5') ||
          file.name.endsWith('.txt')
        ) {
          try {
            const path = desktop.getPathForFile(file)
            const content = await readTextFile(path)
            await addProfileItem({ name: file.name, type: 'local', file: content })
          } catch (e) {
            notifyError(`文件导入失败${e}`)
          }
        } else {
          notifyError('不支持的文件类型')
        }
      } finally {
        isProcessingDrop.current = false
        setFileOver(false)
      }
    }

    pageElement.addEventListener('dragover', handleDragOver)
    pageElement.addEventListener('dragleave', handleDragLeave)
    pageElement.addEventListener('drop', handleDrop)

    return (): void => {
      pageElement.removeEventListener('dragover', handleDragOver)
      pageElement.removeEventListener('dragleave', handleDragLeave)
      pageElement.removeEventListener('drop', handleDrop)
    }
  }, [activeTab, addOverrideItem, addProfileItem])

  useEffect(() => {
    setSortedItems(itemsArray)
  }, [itemsArray])

  useEffect(() => {
    setSortedOverrideItems(overrideItemsArray)
  }, [overrideItemsArray])

  const pageTitle =
    activeTab === 'overrides' ? '覆写管理' : activeTab === 'providers' ? '代理集合' : '订阅管理'

  const pageHeader =
    activeTab === 'overrides' ? (
      <>
        <Button
          size="sm"
          variant="light"
          title="使用文档"
          isIconOnly
          className="app-nodrag"
          onPress={() => {
            open('https://mihomo.party/docs/guide/override')
          }}
        >
          <LuFileText className="h-[18px] w-[18px]" />
        </Button>
        <Button
          className="app-nodrag"
          title="常用覆写仓库"
          isIconOnly
          variant="light"
          size="sm"
          onPress={() => {
            open('https://github.com/mihomo-party-org/override-hub')
          }}
        >
          <FaGithub className="h-[18px] w-[18px]" />
        </Button>
      </>
    ) : activeTab === 'profiles' ? (
      <Button
        size="sm"
        title="订阅设置"
        className="app-nodrag"
        variant="light"
        isIconOnly
        onPress={() => setIsSettingModalOpen(true)}
      >
        <MdTune className="text-lg" />
      </Button>
    ) : null

  return (
    <BasePage ref={pageRef} title={pageTitle} header={pageHeader}>
      {isSettingModalOpen && <ProfileSettingModal onClose={() => setIsSettingModalOpen(false)} />}
      {showEditModal && editingItem && (
        <EditInfoModal
          item={editingItem}
          isCurrent={editingItem.id === current}
          updateProfileItem={async (item: ProfileItem) => {
            if (item.id) {
              await patchProfileItem(item)
            } else {
              await addProfileItem(item)
            }
            setShowEditModal(false)
            setEditingItem(null)
          }}
          onClose={() => {
            setShowEditModal(false)
            setEditingItem(null)
          }}
        />
      )}
      {showOverrideEditModal && editingOverrideItem && (
        <OverrideEditInfoModal
          item={editingOverrideItem}
          updateOverrideItem={async (item: OverrideItem) => {
            if (item.id) {
              await updateOverrideItem(item)
            } else {
              await addOverrideItem(item)
            }
            setShowOverrideEditModal(false)
            setEditingOverrideItem(null)
          }}
          onClose={() => {
            setShowOverrideEditModal(false)
            setEditingOverrideItem(null)
          }}
        />
      )}
      <div className="sticky profiles-sticky top-0 z-40 w-full bg-transparent px-2 pb-2 pt-2 pointer-events-none">
        <div
          className={`w-full gap-2 px-2 py-1.5 pointer-events-auto ${CARD_STYLES.GLASS_TOOLBAR} ${CARD_STYLES.ROUNDED}`}
        >
          <Tabs
            size="md"
            variant="solid"
            radius="lg"
            selectedKey={activeTab}
            onSelectionChange={(key) => handleTabChange(String(key))}
            classNames={CARD_STYLES.GLASS_TABS}
          >
            <Tab key="profiles" title="订阅" />
            <Tab key="overrides" title="覆写" />
            <Tab key="providers" title="代理集合" />
          </Tabs>

          {activeTab === 'profiles' && (
            <>
              <Input
                size="sm"
                className="flex-1"
                classNames={CARD_STYLES.GLASS_INPUT}
                value={url}
                onValueChange={setUrl}
                onKeyUp={handleProfileInputKeyUp}
                endContent={
                  <>
                    <Button
                      size="sm"
                      isIconOnly
                      variant="light"
                      className="z-10"
                      onPress={() => {
                        navigator.clipboard.readText().then((text) => {
                          setUrl(text)
                        })
                      }}
                    >
                      <MdContentPaste className="text-lg" />
                    </Button>
                    <Checkbox className="whitespace-nowrap" checked={useProxy} onValueChange={setUseProxy}>
                      代理
                    </Checkbox>
                  </>
                }
              />

              <Button
                size="sm"
                color="primary"
                className="ml-2"
                isDisabled={isUrlEmpty}
                isLoading={importing}
                onPress={() => handleImport(url)}
              >
                导入
              </Button>
              <Dropdown>
                <DropdownTrigger>
                  <Button className="ml-2 new-profile" size="sm" isIconOnly color="primary">
                    <FaPlus />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu
                  onAction={async (key) => {
                    switch (key) {
                      case 'open': {
                        try {
                          const files = await getFilePath(['yml', 'yaml'])
                          if (files?.length) {
                            const content = await readTextFile(files[0])
                            const fileName = files[0].split('/').pop()?.split('\\').pop()
                            await addProfileItem({ name: fileName, type: 'local', file: content })
                          }
                        } catch (e) {
                          notifyError(e)
                        }
                        break
                      }
                      case 'new': {
                        await addProfileItem({
                          name: '新配置',
                          type: 'local',
                          file: 'proxies: []\nproxy-groups: []\nrules: []'
                        })
                        break
                      }
                      case 'import': {
                        const newRemoteProfile: ProfileItem = {
                          id: '',
                          name: '',
                          type: 'remote',
                          url: '',
                          useProxy: false,
                          autoUpdate: true
                        }
                        setEditingItem(newRemoteProfile)
                        setShowEditModal(true)
                        break
                      }
                    }
                  }}
                >
                  <DropdownItem key="open">打开本地配置</DropdownItem>
                  <DropdownItem key="new">新建本地配置</DropdownItem>
                  <DropdownItem key="import">导入远程配置</DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </>
          )}

          {activeTab === 'overrides' && (
            <>
              <Input
                variant="flat"
                size="sm"
                className="flex-1"
                classNames={CARD_STYLES.GLASS_INPUT}
                value={overrideUrl}
                onValueChange={setOverrideUrl}
                onKeyUp={handleOverrideInputKeyUp}
                endContent={
                  <Button
                    size="sm"
                    isIconOnly
                    variant="light"
                    onPress={() => {
                      navigator.clipboard.readText().then((text) => {
                        setOverrideUrl(text)
                      })
                    }}
                  >
                    <MdContentPaste className="text-lg" />
                  </Button>
                }
              />
              <Button
                size="sm"
                color="primary"
                className="ml-2"
                isDisabled={isOverrideUrlEmpty}
                isLoading={overrideImporting}
                onPress={() => void handleOverrideImport()}
              >
                导入
              </Button>
              <Dropdown>
                <DropdownTrigger>
                  <Button className="ml-2" size="sm" isIconOnly color="primary">
                    <FaPlus />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu
                  onAction={async (key) => {
                    if (key === 'open') {
                      try {
                        const files = await getFilePath(['yaml'])
                        if (files?.length) {
                          const content = await readTextFile(files[0])
                          const fileName = files[0].split('/').pop()?.split('\\').pop()
                          await addOverrideItem({
                            name: fileName,
                            type: 'local',
                            file: content,
                            ext: 'yaml'
                          })
                        }
                      } catch (e) {
                        notifyError(e, { title: '打开本地覆写失败' })
                      }
                    } else if (key === 'new-yaml') {
                      await addOverrideItem({
                        name: '新建 YAML',
                        type: 'local',
                        file: '# https://mihomo.party/docs/guide/override/yaml',
                        ext: 'yaml'
                      })
                    } else if (key === 'import') {
                      const newRemoteOverride: OverrideItem = {
                        id: '',
                        name: '',
                        type: 'remote',
                        url: '',
                        ext: 'yaml',
                        updated: Date.now()
                      }
                      setEditingOverrideItem(newRemoteOverride)
                      setShowOverrideEditModal(true)
                    }
                  }}
                >
                  <DropdownItem key="open">打开本地覆写</DropdownItem>
                  <DropdownItem key="import">导入远程覆写</DropdownItem>
                  <DropdownItem key="new-yaml">新建 YAML</DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </>
          )}

          {activeTab === 'profiles' && (
            <Button
              size="sm"
              isIconOnly
              color="primary"
              isLoading={updating}
              title="更新全部订阅"
              onPress={async () => {
                setUpdating(true)
                for (const item of itemsArray) {
                  if (item.id === current) continue
                  if (item.type !== 'remote') continue
                  await addProfileItem(item)
                }
                const currentItem = itemsArray.find((item) => item.id === current)
                if (currentItem && currentItem.type === 'remote') {
                  await addProfileItem(currentItem)
                }
                setUpdating(false)
              }}
            >
              <IoMdRefresh className="text-lg" />
            </Button>
          )}

          {activeTab === 'providers' && (
            <Button
              size="sm"
              isIconOnly
              color="primary"
              title="更新全部代理集合"
              onPress={updateAllProviders}
            >
              <IoMdRefresh className="text-lg" />
            </Button>
          )}
        </div>
      </div>

      {activeTab === 'profiles' && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onProfileDragEnd}>
          <div
            className={`${fileOver ? 'blur-sm' : ''} mx-2 grid gap-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`}
          >
            <SortableContext items={sortedItems.map((item) => item.id)}>
              {sortedItems.map((item) => (
                <ProfileItem
                  key={item.id}
                  isCurrent={item.id === current}
                  isEnabled={activeProfileIdSet.has(item.id)}
                  canDisable={activeProfileIds.length > 1}
                  addProfileItem={addProfileItem}
                  removeProfileItem={removeProfileItem}
                  mutateProfileConfig={mutateProfileConfig}
                  updateProfileItem={patchProfileItem}
                  info={item}
                  switching={switching}
                  onClick={() => handleProfileCardClick(item.id)}
                  onSetPrimary={() => handleSetPrimaryProfile(item.id)}
                  onToggleEnabled={(nextEnabled) => handleToggleProfileActive(item.id, nextEnabled)}
                />
              ))}
            </SortableContext>
          </div>
        </DndContext>
      )}

      {activeTab === 'overrides' && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onOverrideDragEnd}>
          <div
            className={`${fileOver ? 'blur-sm' : ''} grid gap-2 px-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`}
          >
            <SortableContext items={sortedOverrideItems.map((item) => item.id)}>
              {sortedOverrideItems.map((item) => (
                <OverrideItemCard
                  key={item.id}
                  isActive={currentProfile?.override?.includes(item.id)}
                  onToggleOverride={onToggleOverride}
                  addOverrideItem={addOverrideItem}
                  removeOverrideItem={removeOverrideItem}
                  mutateOverrideConfig={mutateOverrideConfig}
                  updateOverrideItem={updateOverrideItem}
                  info={item}
                />
              ))}
            </SortableContext>
          </div>
        </DndContext>
      )}

      {activeTab === 'providers' && (
        <div className="h-[calc(100vh-100px)]">
          {showProviderDetails.show && (
            <Viewer
              path={showProviderDetails.path}
              type={showProviderDetails.type}
              title={showProviderDetails.title}
              privderType={showProviderDetails.privderType}
              onClose={() =>
                setShowProviderDetails({
                  show: false,
                  path: '',
                  type: '',
                  title: '',
                  privderType: ''
                })
              }
            />
          )}
          <Virtuoso
            data={proxyProviders}
            itemContent={(index, provider) => (
              <ProxyProviderItem
                provider={provider}
                index={index}
                updating={providerUpdating[index] || false}
                onUpdate={() => void onProviderUpdate(provider.name, index)}
                onView={() => {
                  setShowProviderDetails({
                    show: false,
                    privderType: 'proxy-providers',
                    path: provider.name,
                    type: provider.vehicleType,
                    title: provider.name
                  })
                }}
              />
            )}
          />
        </div>
      )}
    </BasePage>
  )
}

const Profiles: React.FC = () => {
  return (
    <OverrideConfigProvider>
      <ProfilesPage />
    </OverrideConfigProvider>
  )
}

export default Profiles
