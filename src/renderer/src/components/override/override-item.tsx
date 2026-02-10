import {
  Button,
  Card,
  CardBody,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger
} from '@heroui/react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IoMdMore, IoMdRefresh } from 'react-icons/io'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { Key, useEffect, useMemo, useState } from 'react'
import EditInfoModal from './edit-info-modal'
import EditFileModal from './edit-file-modal'
import { openFile } from '@renderer/utils/ipc'
import ConfirmModal from '../base/base-confirm'
import { restartCore } from '@renderer/utils/ipc'
import ExecLogModal from './exec-log-modal'
import 'dayjs/locale/zh-cn'
import { CARD_STYLES } from '@renderer/utils/card-styles'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

interface Props {
  info: OverrideItem
  isActive?: boolean
  addOverrideItem: (item: Partial<OverrideItem>) => Promise<void>
  updateOverrideItem: (item: OverrideItem) => Promise<void>
  removeOverrideItem: (id: string) => Promise<void>
  mutateOverrideConfig: () => void
  onToggleOverride?: (id: string, active: boolean) => Promise<void>
}

interface MenuItem {
  key: string
  label: string
  showDivider: boolean
  color: 'default' | 'danger'
  className: string
}

const OverrideItem: React.FC<Props> = (props) => {
  const { info, isActive, addOverrideItem, removeOverrideItem, mutateOverrideConfig, updateOverrideItem, onToggleOverride } =
    props
  const [updating, setUpdating] = useState(false)
  const [openInfoEditor, setOpenInfoEditor] = useState(false)
  const [openFileEditor, setOpenFileEditor] = useState(false)
  const [openLog, setOpenLog] = useState(false)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: info.id
  })
  const transform = tf ? { x: tf.x, y: tf.y, scaleX: 1, scaleY: 1 } : null
  const [disableOpen, setDisableOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const menuItems: MenuItem[] = useMemo(() => {
    const list: MenuItem[] = []
    
    // Restore toggle-override menu item
    if (!info.global) {
        list.push({
            key: 'toggle-override',
            label: isActive ? '禁用覆写' : '启用覆写',
            showDivider: true,
            color: isActive ? 'danger' : 'default',
            className: isActive ? 'text-danger' : ''
        })
    }
    
    list.push({
        key: 'toggle-global',
        label: info.global ? '取消全局覆写' : '设为全局覆写',
        showDivider: true,
        color: 'default',
        className: ''
      })
    
    list.push(
      {
        key: 'edit-info',
        label: '编辑信息',
        showDivider: false,
        color: 'default',
        className: ''
      },
      {
        key: 'edit-file',
        label: '编辑文件',
        showDivider: false,
        color: 'default',
        className: ''
      },
      {
        key: 'open-file',
        label: '打开文件',
        showDivider: false,
        color: 'default',
        className: ''
      },
      {
        key: 'exec-log',
        label: '执行日志',
        showDivider: true,
        color: 'default',
        className: ''
      },
      {
        key: 'delete',
        label: '删除',
        showDivider: false,
        color: 'danger',
        className: 'text-danger'
      }
    )
    if (info.ext === 'yaml') {
      const execLogIndex = list.findIndex(i => i.key === 'exec-log')
      if (execLogIndex !== -1) list.splice(execLogIndex, 1)
    }
    return list
  }, [info, isActive])

  const onMenuAction = async (key: Key): Promise<void> => {
    switch (key) {
      case 'toggle-override': {
        if (onToggleOverride) {
            try {
                await onToggleOverride(info.id, !!isActive)
                mutateOverrideConfig()
            } catch (e) {
                alert(e)
            }
        }
        break
      }
      case 'toggle-global': {
        try {
          await updateOverrideItem({ ...info, global: !info.global })
          await restartCore()
          mutateOverrideConfig()
        } catch (e) {
          alert(e)
        }
        break
      }
      case 'edit-info': {
        setOpenInfoEditor(true)
        break
      }
      case 'edit-file': {
        setOpenFileEditor(true)
        break
      }
      case 'open-file': {
        openFile('override', info.id, info.ext)
        break
      }
      case 'exec-log': {
        setOpenLog(true)
        break
      }
      case 'delete': {
        setConfirmOpen(true)
        break
      }
    }
  }

  useEffect(() => {
    if (isDragging) {
      setTimeout(() => {
        setDisableOpen(true)
      }, 200)
    } else {
      setTimeout(() => {
        setDisableOpen(false)
      }, 200)
    }
  }, [isDragging])

  return (
    <div
      className="grid col-span-1"
      style={{
        position: 'relative',
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 'calc(infinity)' : undefined
      }}
    >
      {openFileEditor && (
        <EditFileModal
          id={info.id}
          language={info.ext === 'yaml' ? 'yaml' : 'javascript'}
          onClose={() => setOpenFileEditor(false)}
        />
      )}
      {openInfoEditor && (
        <EditInfoModal
          item={info}
          onClose={() => setOpenInfoEditor(false)}
          updateOverrideItem={updateOverrideItem}
        />
      )}
      {confirmOpen && (
        <ConfirmModal
          onChange={setConfirmOpen}
          title="确认删除覆写？"
          confirmText="确认删除"
          cancelText="取消"
          onConfirm={() => {
            removeOverrideItem(info.id)
            mutateOverrideConfig()
          }}
        />
      )}
      {openLog && <ExecLogModal id={info.id} onClose={() => setOpenLog(false)} />}
      <Card
        as="div"
        fullWidth
        isPressable
        className={`
          ${CARD_STYLES.BASE}
          ${
            info.global || isActive
              ? CARD_STYLES.ACTIVE
              : CARD_STYLES.INACTIVE
          }
        `}
        onPress={() => {
          if (disableOpen) return
          setOpenFileEditor(true)
        }}
      >
        <div ref={setNodeRef} {...attributes} {...listeners} className="h-full w-full">
          <CardBody className="pb-2">
            <div className="flex justify-between h-[32px]">
              <h3
                title={info?.name}
                className={`text-ellipsis whitespace-nowrap overflow-hidden text-md font-bold leading-[32px] ${info.global || isActive ? 'text-primary-foreground' : 'text-foreground'}`}
              >
                {info?.name}
              </h3>
              <div className="flex" onClick={(e) => e.stopPropagation()}>
                {info.type === 'remote' && (
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    color="default"
                    disabled={updating}
                    onPress={async () => {
                      setUpdating(true)
                      try {
                        await addOverrideItem(info)
                        await restartCore()
                      } catch (e) {
                        alert(e)
                      } finally {
                        setUpdating(false)
                      }
                    }}
                  >
                    <IoMdRefresh
                      className={`text-[20px] ${info.global || isActive ? 'text-primary-foreground' : 'text-foreground-500'} ${updating ? 'animate-spin' : ''}`}
                    />
                  </Button>
                )}

                <Dropdown>
                  <DropdownTrigger>
                    <Button isIconOnly size="sm" variant="light" color="default">
                      <IoMdMore className={`text-[20px] ${info.global || isActive ? 'text-primary-foreground' : 'text-foreground-500'}`} />
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu onAction={onMenuAction}>
                    {menuItems.map((item) => (
                      <DropdownItem
                        showDivider={item.showDivider}
                        key={item.key}
                        color={item.color}
                        className={item.className}
                      >
                        {item.label}
                      </DropdownItem>
                    ))}
                  </DropdownMenu>
                </Dropdown>
              </div>
            </div>
            <div className="flex justify-between items-end mt-2">
              <div className={`flex justify-start items-center gap-2`}>
                {info.global ? (
                  <Chip
                    size="sm"
                    variant="solid"
                    className={`bg-yellow-400 text-black font-bold shadow-sm`}
                  >
                    全局
                  </Chip>
                ) : (
                   isActive && (
                    <Chip
                        size="sm"
                        variant="solid"
                        className={`bg-yellow-400 text-black font-bold shadow-sm`}
                    >
                        已启用
                    </Chip>
                   )
                )}
                <Chip
                  size="sm"
                  variant="bordered"
                  className={`${info.global || isActive ? 'text-primary-foreground border-primary-foreground/50' : 'border-default-400 text-default-600'}`}
                >
                  {info.ext === 'yaml' ? 'YAML' : 'JavaScript'}
                </Chip>
              </div>
              {info.type === 'remote' && (
                <div className={`flex justify-end ${info.global || isActive ? 'text-primary-foreground/80' : 'text-foreground-400'}`}>
                  <small>{dayjs(info.updated).fromNow()}</small>
                </div>
              )}
            </div>
          </CardBody>
        </div>
      </Card>
    </div>
  )
}

export default OverrideItem
