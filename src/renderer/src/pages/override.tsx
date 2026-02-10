import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input
} from '@heroui/react'
import { useProfileConfig } from '@renderer/hooks/use-profile-config'
import BasePage from '@renderer/components/base/base-page'
import { getFilePath, readTextFile, updateProfileItem, restartCore } from '@renderer/utils/ipc'
import { useEffect, useRef, useState } from 'react'
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
import { useOverrideConfig } from '@renderer/hooks/use-override-config'
import OverrideItem from '@renderer/components/override/override-item'
import EditInfoModal from '@renderer/components/override/edit-info-modal'
import { FaPlus } from 'react-icons/fa6'
import { LuFileText } from 'react-icons/lu'
import { FaGithub } from 'react-icons/fa6'
import { CARD_STYLES } from '@renderer/utils/card-styles'

const emptyItems: OverrideItem[] = []

const Override: React.FC = () => {
  const {
    overrideConfig,
    setOverrideConfig,
    addOverrideItem,
    updateOverrideItem,
    removeOverrideItem,
    mutateOverrideConfig
  } = useOverrideConfig()

  const { profileConfig, mutateProfileConfig } = useProfileConfig()
  const currentProfile = profileConfig?.items?.find((p) => p.id === profileConfig?.current)

  const { items } = overrideConfig || {}
  const itemsArray = items ?? emptyItems
  const [sortedItems, setSortedItems] = useState(itemsArray)
  const [importing, setImporting] = useState(false)
  const [fileOver, setFileOver] = useState(false)
  const [url, setUrl] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingItem, setEditingItem] = useState<OverrideItem | null>(null)

  const onToggleOverride = async (id: string, active: boolean): Promise<void> => {
    if (!currentProfile) return
    let newOverride = currentProfile.override || []
    if (active) {
      newOverride = newOverride.filter((oid) => oid !== id)
    } else {
      if (!newOverride.includes(id)) {
        newOverride = [...newOverride, id]
      }
    }
    await updateProfileItem({ ...currentProfile, override: newOverride })
    await restartCore()
    mutateProfileConfig()
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 2
      }
    })
  )
  const isProcessingDrop = useRef(false)
  const handleImport = async (): Promise<void> => {
    setImporting(true)
    try {
      const urlObj = new URL(url)
      const name = urlObj.pathname.split('/').pop()
      await addOverrideItem({
        name: name ? decodeURIComponent(name) : undefined,
        type: 'remote',
        url,
        ext: urlObj.pathname.endsWith('.js') ? 'js' : 'yaml'
      })
    } finally {
      setImporting(false)
    }
  }
  const pageRef = useRef<HTMLDivElement>(null)

  const onDragEnd = async (event: DragEndEvent): Promise<void> => {
    const { active, over } = event
    if (over) {
      if (active.id !== over.id) {
        const newOrder = sortedItems.slice()
        const activeIndex = newOrder.findIndex((item) => item.id === active.id)
        const overIndex = newOrder.findIndex((item) => item.id === over.id)
        newOrder.splice(activeIndex, 1)
        newOrder.splice(overIndex, 0, itemsArray[activeIndex])
        setSortedItems(newOrder)
        await setOverrideConfig({ items: newOrder })
      }
    }
  }

  useEffect(() => {
    pageRef.current?.addEventListener('dragover', (e) => {
      e.preventDefault()
      e.stopPropagation()
      setFileOver(true)
    })
    pageRef.current?.addEventListener('dragleave', (e) => {
      e.preventDefault()
      e.stopPropagation()
      setFileOver(false)
    })
    pageRef.current?.addEventListener('drop', async (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (isProcessingDrop.current) return
      isProcessingDrop.current = true
      if (event.dataTransfer?.files) {
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
            const path = window.api.webUtils.getPathForFile(file)
            const content = await readTextFile(path)
            await addOverrideItem({
              name: file.name,
              type: 'local',
              file: content,
              ext: file.name.endsWith('.js') ? 'js' : 'yaml'
            })
          } catch (e) {
            alert('文件导入失败' + e)
          }
        } else {
          alert('不支持的文件类型')
        }
      }
      isProcessingDrop.current = false
      setFileOver(false)
    })
    return (): void => {
      pageRef.current?.removeEventListener('dragover', () => {})
      pageRef.current?.removeEventListener('dragleave', () => {})
      pageRef.current?.removeEventListener('drop', () => {})
    }
  }, [])

  useEffect(() => {
    setSortedItems(itemsArray)
  }, [itemsArray])

  return (
    <BasePage
      ref={pageRef}
      title="覆写"
      header={
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
            <LuFileText className="w-[18px] h-[18px]" />
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
            <FaGithub className="w-[18px] h-[18px]" />
          </Button>
        </>
      }
    >
      <div className="sticky top-0 z-40 bg-transparent w-full pb-2 px-2 pt-2 pointer-events-none">
        <div className={`w-full px-2 py-1.5 flex gap-2 pointer-events-auto ${CARD_STYLES.GLASS_TOOLBAR} ${CARD_STYLES.ROUNDED}`}>
          <Input
            variant="flat"
            size="sm"
            classNames={CARD_STYLES.GLASS_INPUT}
            value={url}
            onValueChange={setUrl}
            endContent={
              <Button
                size="sm"
                isIconOnly
                variant="light"
                onPress={() => {
                  navigator.clipboard.readText().then((text) => {
                    setUrl(text)
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
            isDisabled={url === ''}
            isLoading={importing}
            onPress={handleImport}
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
                    const files = await getFilePath(['js', 'yaml'])
                    if (files?.length) {
                      const content = await readTextFile(files[0])
                      const fileName = files[0].split('/').pop()?.split('\\').pop()
                      await addOverrideItem({
                        name: fileName,
                        type: 'local',
                        file: content,
                        ext: fileName?.endsWith('.js') ? 'js' : 'yaml'
                      })
                    }
                  } catch (e) {
                    alert(e)
                  }
                } else if (key === 'new-yaml') {
                  await addOverrideItem({
                    name: '新建 YAML',
                    type: 'local',
                    file: '# https://mihomo.party/docs/guide/override/yaml',
                    ext: 'yaml'
                  })
                } else if (key === 'new-js') {
                  await addOverrideItem({
                    name: '新建 JS',
                    type: 'local',
                    file: '// https://mihomo.party/docs/guide/override/javascript\nfunction main(config) {\n  return config\n}',
                    ext: 'js'
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
                  setEditingItem(newRemoteOverride)
                  setShowEditModal(true)
                }
              }}
            >
              <DropdownItem key="open">打开本地覆写</DropdownItem>
              <DropdownItem key="import">导入远程覆写</DropdownItem>
              <DropdownItem key="new-yaml">新建 YAML</DropdownItem>
              <DropdownItem key="new-js">新建 JavaScript</DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div
          className={`${fileOver ? 'blur-sm' : ''} grid sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 px-2`}
        >
          <SortableContext
            items={sortedItems.map((item) => {
              return item.id
            })}
          >
            {sortedItems.map((item) => (
              <OverrideItem
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
      {showEditModal && editingItem && (
        <EditInfoModal
          item={editingItem}
          updateOverrideItem={async (item: OverrideItem) => {
            await addOverrideItem(item)
            setShowEditModal(false)
            setEditingItem(null)
          }}
          onClose={() => {
            setShowEditModal(false)
            setEditingItem(null)
          }}
        />
      )}
    </BasePage>
  )
}

export default Override
