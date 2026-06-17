import {
  Button,
  Checkbox,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input
} from '@heroui/react'

import ProfileItemCard from '@renderer/components/profiles/profile-item'
import EditInfoModal from '@renderer/components/profiles/edit-info-modal'
import { useProfileConfig } from '@renderer/hooks/use-profile-config'
import { getFilePath, readTextFile } from '@renderer/utils/file-ipc'
import { updateProfileItem as patchProfileItemServer } from '@renderer/utils/profile-ipc'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Key, KeyboardEvent } from 'react'
import { MdContentPaste } from 'react-icons/md'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { FaPlus } from 'react-icons/fa6'
import { notifyError } from '@renderer/utils/notify'
import { desktop } from '@renderer/api/desktop'
import { IoMdRefresh } from 'react-icons/io'
import { useI18n } from '@renderer/i18n'

const emptyProfileItems: ProfileItem[] = []

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

function getFileName(filePath: string): string | undefined {
  return filePath.split('/').pop()?.split('\\').pop()
}

export const ProfileTabContent: React.FC<{ toolbarContainer?: HTMLDivElement | null }> = ({
  toolbarContainer
}) => {
  const { t } = useI18n()
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

  const { current, items, actives } = profileConfig || {}
  const itemsArray = items ?? emptyProfileItems
  const activeProfileIds = useMemo(
    () => (actives && actives.length > 0 ? actives : current ? [current] : []),
    [actives, current]
  )
  const activeProfileIdSet = useMemo(() => new Set(activeProfileIds), [activeProfileIds])

  const [sortedItems, setSortedItems] = useState(itemsArray)
  const [useProxy, setUseProxy] = useState(false)
  const [importing, setImporting] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [fileOver, setFileOver] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingItem, setEditingItem] = useState<ProfileItem | null>(null)
  const [url, setUrl] = useState('')
  const isUrlEmpty = url.trim() === ''

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 2
      }
    })
  )

  const handleImport = async (importUrl: string): Promise<void> => {
    setImporting(true)
    await addProfileItem({ name: '', type: 'remote', url: importUrl, useProxy, autoUpdate: true })
    setUrl('')
    setImporting(false)
  }

  const handleProfileInputKeyUp = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter' || isUrlEmpty) return
      void handleImport((e.currentTarget as HTMLInputElement).value)
    },
    [isUrlEmpty]
  )

  const handleProfileCreateAction = useCallback(
    async (key: Key): Promise<void> => {
      switch (key) {
        case 'open': {
          try {
            const files = await getFilePath(['yml', 'yaml'])
            if (!files?.length) return

            const content = await readTextFile(files[0])
            await addProfileItem({ name: getFileName(files[0]), type: 'local', file: content })
          } catch (e) {
            notifyError(e)
          }
          break
        }
        case 'new':
          await addProfileItem({
            name: t('profiles.newProfileName'),
            type: 'local',
            file: 'proxies: []\nproxy-groups: []\nrules: []'
          })
          break
        case 'import':
          setEditingItem({
            id: '',
            name: '',
            type: 'remote',
            url: '',
            useProxy: false,
            autoUpdate: true
          })
          setShowEditModal(true)
          break
      }
    },
    [addProfileItem, t]
  )

  const runSelectionMutation = useCallback(async (action: () => Promise<void>): Promise<void> => {
    setSwitching(true)
    try {
      await action()
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 500))
      setSwitching(false)
    }
  }, [])

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

  const pageRef = useRef<HTMLDivElement>(null)
  const isProcessingDrop = useRef(false)

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
            notifyError(t('profiles.fileImportFailed', { error: String(e) }))
          }
        } else {
          notifyError(t('profiles.unsupportedFileType'))
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
  }, [addProfileItem, t])

  useEffect(() => {
    setSortedItems(itemsArray)
  }, [itemsArray])

  return (
    <div ref={pageRef} className="flex-1 w-full relative">
      {showEditModal && editingItem && (
        <EditInfoModal
          item={editingItem}
          updateProfileItem={async (item: ProfileItem) => {
            if (item.id) {
              await patchProfileItemServer(item)
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

      {toolbarContainer &&
        createPortal(
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
                  <Checkbox
                    size="sm"
                    radius="sm"
                    color="primary"
                    className="whitespace-nowrap mr-1"
                    isSelected={useProxy}
                    onValueChange={setUseProxy}
                  >
                    <span className="text-sm text-default-600">{t('page.profiles.useProxy')}</span>
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
              {t('common.import')}
            </Button>

            <Button
              size="sm"
              isIconOnly
              color="primary"
              isLoading={updating}
              title={t('page.profiles.updateAllProfiles')}
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

            <Dropdown classNames={CARD_STYLES.GLASS_DROPDOWN}>
              <DropdownTrigger>
                <Button
                  size="sm"
                  isIconOnly
                  color="primary"
                  className="new-profile"
                  title={t('page.profiles.openLocal')}
                >
                  <FaPlus />
                </Button>
              </DropdownTrigger>
              <DropdownMenu onAction={handleProfileCreateAction}>
                <DropdownItem key="open">{t('page.profiles.openLocal')}</DropdownItem>
                <DropdownItem key="new">{t('page.profiles.newLocal')}</DropdownItem>
                <DropdownItem key="import">{t('page.profiles.importRemote')}</DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </>,
          toolbarContainer
        )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onProfileDragEnd}>
        <div
          className={`${fileOver ? 'blur-sm' : ''} mx-2 grid gap-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`}
        >
          <SortableContext items={sortedItems.map((item) => item.id)}>
            {sortedItems.map((item) => (
              <ProfileItemCard
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
    </div>
  )
}
