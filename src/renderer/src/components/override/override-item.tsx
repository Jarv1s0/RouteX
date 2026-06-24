import {
  Button,
  Card,
  CardBody,
  CardFooter,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Spinner
} from '@heroui/react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IoMdMore, IoMdRefresh } from 'react-icons/io'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { Key, useEffect, useMemo, useRef, useState } from 'react'
import EditInfoModal from './edit-info-modal'
import EditFileModal from './edit-file-modal'
import { openFile } from '@renderer/utils/file-ipc'
import { canRollbackOverride, rollbackOverride } from '@renderer/utils/override-ipc'
import ConfirmModal from '../base/base-confirm'
import ExecLogModal from './exec-log-modal'
import 'dayjs/locale/zh-cn'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { useI18n } from '@renderer/i18n'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

interface Props {
  info: OverrideItem
  isActive?: boolean
  addOverrideItem: (item: Partial<OverrideItem>) => Promise<boolean | void>
  updateOverrideItem: (item: OverrideItem) => Promise<boolean | void>
  removeOverrideItem: (id: string) => Promise<boolean | void>
  mutateOverrideConfig: () => void
  onToggleOverride?: (id: string, active: boolean) => Promise<void>
}

interface MenuItem {
  key: string
  label: string
  showDivider: boolean
  color: 'default' | 'danger' | 'warning'
  className: string
}

const OverrideItem: React.FC<Props> = (props) => {
  const {
    info,
    isActive,
    addOverrideItem,
    removeOverrideItem,
    mutateOverrideConfig,
    updateOverrideItem,
    onToggleOverride
  } = props
  const { t } = useI18n()
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
  const [rollbackAvailable, setRollbackAvailable] = useState(false)
  const [rollingBack, setRollingBack] = useState(false)
  const dragReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wasDraggingRef = useRef(false)

  const menuItems: MenuItem[] = useMemo(() => {
    const list: MenuItem[] = [
      {
        key: 'edit-info',
        label: t('override.editInfo'),
        showDivider: false,
        color: 'default',
        className: ''
      },
      {
        key: 'edit-file',
        label: t('override.editContent'),
        showDivider: false,
        color: 'default',
        className: ''
      },
      {
        key: 'open-file',
        label: t('override.openExternal'),
        showDivider: false,
        color: 'default',
        className: ''
      },
      {
        key: 'exec-log',
        label: t('override.execLog'),
        showDivider: true,
        color: 'default',
        className: ''
      },
      {
        key: 'rollback',
        label: t('override.rollback'),
        showDivider: true,
        color: 'warning',
        className: 'text-warning'
      },
      {
        key: 'delete',
        label: t('common.delete'),
        showDivider: false,
        color: 'danger',
        className: 'text-danger'
      }
    ]
    if (info.ext === 'yaml') {
      const execLogIndex = list.findIndex((i) => i.key === 'exec-log')
      if (execLogIndex !== -1) list.splice(execLogIndex, 1)
    }
    if (!rollbackAvailable) {
      const rollbackIndex = list.findIndex((item) => item.key === 'rollback')
      if (rollbackIndex !== -1) list.splice(rollbackIndex, 1)
    }
    return list
  }, [info.ext, rollbackAvailable, t])

  const statusLabel = info.global
    ? t('override.status.global')
    : isActive
      ? t('override.status.enabled')
      : t('override.status.disabled')
  const statusClassName =
    info.global || isActive
      ? 'bg-yellow-400 text-black font-bold shadow-sm'
      : CARD_STYLES.MANAGEMENT_STATUS_INACTIVE

  const setLocalOverrideActive = async (active: boolean): Promise<boolean> => {
    if (!onToggleOverride || active === !!isActive) return true
    await onToggleOverride(info.id, !!isActive)
    return true
  }

  const setGlobalOverride = async (global: boolean): Promise<boolean> => {
    if (info.global === global) return true
    const success = await updateOverrideItem({ ...info, global })
    if (success === false) return false
    mutateOverrideConfig()
    return true
  }

  const onStatusAction = async (key: Key): Promise<void> => {
    try {
      setUpdating(true)
      switch (key) {
        case 'disabled': {
          if (!(await setGlobalOverride(false))) return
          await setLocalOverrideActive(false)
          break
        }
        case 'enabled': {
          if (!(await setGlobalOverride(false))) return
          await setLocalOverrideActive(true)
          break
        }
        case 'global': {
          await setGlobalOverride(true)
          break
        }
      }
    } catch (e) {
      alert(e)
    } finally {
      setUpdating(false)
    }
  }

  const onMenuAction = async (key: Key): Promise<void> => {
    switch (key) {
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
      case 'rollback': {
        try {
          setRollingBack(true)
          await rollbackOverride(info.id, info.ext)
          mutateOverrideConfig()
          setRollbackAvailable(await canRollbackOverride(info.id, info.ext))
        } catch (e) {
          alert(e)
        } finally {
          setRollingBack(false)
        }
        break
      }
      case 'delete': {
        setConfirmOpen(true)
        break
      }
    }
  }

  useEffect(() => {
    if (dragReleaseTimerRef.current) {
      clearTimeout(dragReleaseTimerRef.current)
      dragReleaseTimerRef.current = null
    }

    if (isDragging) {
      wasDraggingRef.current = true
      setDisableOpen(true)
      return
    }

    if (wasDraggingRef.current) {
      dragReleaseTimerRef.current = setTimeout(() => {
        setDisableOpen(false)
        dragReleaseTimerRef.current = null
      }, 200)
      wasDraggingRef.current = false
    }

    return () => {
      if (dragReleaseTimerRef.current) {
        clearTimeout(dragReleaseTimerRef.current)
        dragReleaseTimerRef.current = null
      }
    }
  }, [isDragging])

  useEffect(() => {
    let mounted = true

    const syncRollbackState = async (): Promise<void> => {
      try {
        const available = await canRollbackOverride(info.id, info.ext)
        if (mounted) {
          setRollbackAvailable(available)
        }
      } catch {
        if (mounted) {
          setRollbackAvailable(false)
        }
      }
    }

    syncRollbackState()

    return (): void => {
      mounted = false
    }
  }, [info.ext, info.id, openFileEditor])

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
          title={t('override.deleteTitle')}
          confirmText={t('settings.advanced.confirmDelete')}
          cancelText={t('common.cancel')}
          onConfirm={() => {
            void removeOverrideItem(info.id).then((success) => {
              if (success === false) return
              mutateOverrideConfig()
            })
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
          ${info.global || isActive ? CARD_STYLES.ACTIVE : CARD_STYLES.INACTIVE}
        `}
        onPress={() => {
          if (disableOpen) return
          setOpenFileEditor(true)
        }}
      >
        {updating && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/60">
            <Spinner size="sm" />
          </div>
        )}
        <div ref={setNodeRef} {...attributes} {...listeners} className="w-full h-full">
          <CardBody className="pt-2.5 pb-1 px-3 overflow-hidden">
            <div className="flex min-h-[28px] items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 title={info?.name} className={CARD_STYLES.MANAGEMENT_TITLE}>
                  {info?.name}
                </h3>
              </div>
              <div
                className="flex shrink-0 items-center gap-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                {info.type === 'remote' && (
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    color="default"
                    className={CARD_STYLES.MANAGEMENT_ACTION_BUTTON}
                    disabled={updating || rollingBack}
                    onPress={async () => {
                      setUpdating(true)
                      try {
                        const success = await addOverrideItem(info)
                        if (success) {
                          setRollbackAvailable(await canRollbackOverride(info.id, info.ext))
                        }
                      } catch (e) {
                        alert(e)
                      } finally {
                        setUpdating(false)
                      }
                    }}
                  >
                    <IoMdRefresh
                      className={`${CARD_STYLES.MANAGEMENT_ACTION_ICON} ${updating ? 'animate-spin' : ''}`}
                    />
                  </Button>
                )}

                <Dropdown classNames={CARD_STYLES.GLASS_DROPDOWN}>
                  <DropdownTrigger>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      color="default"
                      className={CARD_STYLES.MANAGEMENT_ACTION_BUTTON}
                    >
                      <IoMdMore className={CARD_STYLES.MANAGEMENT_ACTION_ICON} />
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
          </CardBody>
          <CardFooter className="pt-0 pb-2.5 px-3">
            <div className={`w-full mt-2 ${CARD_STYLES.MANAGEMENT_FOOTER_ROW}`}>
              <div
                className={`flex justify-start items-center gap-2`}
                onClick={(e) => e.stopPropagation()}
              >
                <Dropdown placement="bottom-start" classNames={CARD_STYLES.GLASS_DROPDOWN}>
                  <DropdownTrigger>
                    <Button
                      size="sm"
                      radius="full"
                      variant={info.global || isActive ? 'solid' : 'bordered'}
                      className={`${CARD_STYLES.MANAGEMENT_STATUS_BUTTON} ${statusClassName}`}
                      isDisabled={updating || rollingBack}
                    >
                      {statusLabel}
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu
                    onAction={onStatusAction}
                    selectedKeys={[info.global ? 'global' : isActive ? 'enabled' : 'disabled']}
                  >
                    <DropdownItem key="disabled">{t('override.disable')}</DropdownItem>
                    <DropdownItem key="enabled">{t('override.enable')}</DropdownItem>
                    <DropdownItem key="global">{t('override.setGlobal')}</DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </div>
              {info.type === 'remote' && (
                <div className="flex justify-end">
                  <small>{dayjs(info.updated).fromNow()}</small>
                </div>
              )}
            </div>
          </CardFooter>
        </div>
      </Card>
    </div>
  )
}

export default OverrideItem
