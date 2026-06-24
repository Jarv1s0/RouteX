import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Input } from '@heroui/react'
import OverrideItemCard from '@renderer/components/override/override-item'
import OverrideEditInfoModal from '@renderer/components/override/edit-info-modal'
import { useOverrideConfig } from '@renderer/hooks/use-override-config'
import { getFilePath, readTextFile } from '@renderer/utils/file-ipc'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Key, KeyboardEvent } from 'react'
import { IoMdRefresh } from 'react-icons/io'
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
import {
  DEFAULT_JAVASCRIPT_OVERRIDE,
  inferOverrideExt,
  OVERRIDE_FILE_EXTENSIONS
} from '@renderer/utils/override-format'
import { useI18n } from '@renderer/i18n'
import { useProfileConfig } from '@renderer/hooks/use-profile-config'
import { updateProfileItem } from '@renderer/utils/profile-ipc'

function getFileName(filePath: string): string | undefined {
  return filePath.split('/').pop()?.split('\\').pop()
}

export const OverrideTabContent: React.FC<{ toolbarContainer?: HTMLDivElement | null }> = ({
  toolbarContainer
}) => {
  const { t } = useI18n()
  const { profileConfig, mutateProfileConfig } = useProfileConfig()
  const { current, items } = profileConfig || {}
  const currentProfile = useMemo(() => items?.find((item) => item.id === current), [current, items])

  const {
    overrideConfig,
    setOverrideConfig,
    addOverrideItem,
    updateOverrideItem,
    removeOverrideItem,
    mutateOverrideConfig
  } = useOverrideConfig()
  const { items: overrideItems } = overrideConfig || {}
  const overrideItemsArray = overrideItems ?? []

  const [sortedOverrideItems, setSortedOverrideItems] = useState(overrideItemsArray)
  const [overrideImporting, setOverrideImporting] = useState(false)
  const [overrideUpdating, setOverrideUpdating] = useState(false)
  const [fileOver, setFileOver] = useState(false)
  const [showOverrideEditModal, setShowOverrideEditModal] = useState(false)
  const [editingOverrideItem, setEditingOverrideItem] = useState<OverrideItem | null>(null)
  const [overrideUrl, setOverrideUrl] = useState('')
  const isOverrideUrlEmpty = overrideUrl.trim() === ''

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 2
      }
    })
  )

  const handleOverrideImport = useCallback(async () => {
    setOverrideImporting(true)
    try {
      const urlObj = new URL(overrideUrl)
      const name = urlObj.pathname.split('/').pop()
      const success = await addOverrideItem({
        name: name ? decodeURIComponent(name) : undefined,
        type: 'remote',
        url: overrideUrl,
        ext: urlObj.pathname.endsWith('.js') ? 'js' : 'yaml'
      })
      if (success) {
        setOverrideUrl('')
      }
    } catch (e) {
      notifyError(e, { title: t('profiles.importOverrideFailed') })
    } finally {
      setOverrideImporting(false)
    }
  }, [addOverrideItem, overrideUrl, t])

  const handleOverrideCreateAction = useCallback(
    async (key: Key): Promise<void> => {
      switch (key) {
        case 'open': {
          try {
            const files = await getFilePath(OVERRIDE_FILE_EXTENSIONS)
            if (!files?.length) return

            const content = await readTextFile(files[0])
            const fileName = getFileName(files[0])
            await addOverrideItem({
              name: fileName,
              type: 'local',
              file: content,
              ext: inferOverrideExt(fileName)
            })
          } catch (e) {
            notifyError(e, { title: t('profiles.openLocalOverrideFailed') })
          }
          break
        }
        case 'new-yaml':
          await addOverrideItem({
            name: t('profiles.newYamlOverride'),
            type: 'local',
            file: '# https://mihomo.party/docs/guide/override/yaml',
            ext: 'yaml'
          })
          break
        case 'new-js':
          await addOverrideItem({
            name: t('profiles.newJsOverride'),
            type: 'local',
            file: DEFAULT_JAVASCRIPT_OVERRIDE,
            ext: 'js'
          })
          break
        case 'import':
          setEditingOverrideItem({
            id: '',
            name: '',
            type: 'remote',
            url: '',
            ext: 'yaml',
            updated: Date.now()
          })
          setShowOverrideEditModal(true)
          break
      }
    },
    [addOverrideItem, t]
  )

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
    },
    [currentProfile, mutateProfileConfig]
  )

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

  const handleOverrideInputKeyUp = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter' || isOverrideUrlEmpty) return
      void handleOverrideImport()
    },
    [handleOverrideImport, isOverrideUrlEmpty]
  )

  const handleUpdateAllOverrides = useCallback(async (): Promise<void> => {
    setOverrideUpdating(true)
    try {
      for (const item of overrideItemsArray) {
        if (item.type !== 'remote') continue
        await addOverrideItem(item)
      }
    } finally {
      setOverrideUpdating(false)
    }
  }, [addOverrideItem, overrideItemsArray])

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
            notifyError(t('profiles.fileImportFailed', { error: String(e) }), {
              title: t('profiles.importFailed')
            })
          }
        } else {
          notifyError(t('profiles.unsupportedFileType'), { title: t('profiles.importFailed') })
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
  }, [addOverrideItem, t])

  useEffect(() => {
    setSortedOverrideItems(overrideItemsArray)
  }, [overrideItemsArray])

  return (
    <div ref={pageRef} className="flex-1 w-full relative">
      {showOverrideEditModal && editingOverrideItem && (
        <OverrideEditInfoModal
          item={editingOverrideItem}
          updateOverrideItem={async (item: OverrideItem) => {
            if (item.id) {
              const success = await updateOverrideItem(item)
              if (!success) return
            } else {
              const success = await addOverrideItem(item)
              if (!success) return
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

      {toolbarContainer &&
        createPortal(
          <>
            <Input
              size="sm"
              className="flex-1"
              classNames={CARD_STYLES.GLASS_INPUT}
              value={overrideUrl}
              onValueChange={setOverrideUrl}
              onKeyUp={handleOverrideInputKeyUp}
            />
            <Button
              size="sm"
              color="primary"
              className="ml-2"
              isDisabled={isOverrideUrlEmpty}
              isLoading={overrideImporting}
              onPress={() => handleOverrideImport()}
            >
              {t('common.import')}
            </Button>
            <Button
              size="sm"
              isIconOnly
              color="primary"
              isLoading={overrideUpdating}
              title={t('page.profiles.updateAllOverrides')}
              onPress={() => void handleUpdateAllOverrides()}
            >
              <IoMdRefresh className="text-lg" />
            </Button>
            <Dropdown classNames={CARD_STYLES.GLASS_DROPDOWN} placement="bottom-end">
              <DropdownTrigger>
                <Button
                  size="sm"
                  isIconOnly
                  color="primary"
                  title={t('profiles.openLocalOverride')}
                >
                  <FaPlus />
                </Button>
              </DropdownTrigger>
              <DropdownMenu onAction={handleOverrideCreateAction}>
                <DropdownItem key="open">{t('profiles.openLocalOverride')}</DropdownItem>
                <DropdownItem key="new-yaml">{t('profiles.newYamlOverride')}</DropdownItem>
                <DropdownItem key="new-js">{t('profiles.newJsOverride')}</DropdownItem>
                <DropdownItem key="import">{t('profiles.importRemoteOverride')}</DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </>,
          toolbarContainer
        )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onOverrideDragEnd}
      >
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
    </div>
  )
}
