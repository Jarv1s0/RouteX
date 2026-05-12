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
import TrafficProgress from '@renderer/components/base/traffic-progress'
import { calcPercent, calcTraffic } from '@renderer/utils/calc'
import { IoMdMore, IoMdRefresh } from 'react-icons/io'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import React, { Key, useEffect, useMemo, useRef, useState } from 'react'
import EditFileModal from './edit-file-modal'
import EditInfoModal from './edit-info-modal'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { openFile } from '@renderer/utils/file-ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import ConfirmModal from '../base/base-confirm'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

interface Props {
  info: ProfileItem
  isCurrent: boolean
  addProfileItem: (item: Partial<ProfileItem>) => Promise<void>
  updateProfileItem: (item: ProfileItem) => Promise<void>
  removeProfileItem: (id: string) => Promise<void>
  mutateProfileConfig: () => void
  onClick: () => Promise<void>
  onSetPrimary: () => Promise<void>
  onToggleEnabled: (nextEnabled: boolean) => Promise<void>
  switching: boolean
  isEnabled: boolean
  canDisable: boolean
}

interface MenuItem {
  key: string
  label: string
  showDivider: boolean
  color: 'default' | 'danger'
  className: string
}
const ProfileItem: React.FC<Props> = (props) => {
  const {
    info,
    addProfileItem,
    removeProfileItem,
    mutateProfileConfig,
    updateProfileItem,
    onClick,
    onSetPrimary,
    isCurrent,
    switching,
    onToggleEnabled,
    isEnabled,
    canDisable
  } = props
  const extra = info?.extra
  const usage = (extra?.upload ?? 0) + (extra?.download ?? 0)
  const total = extra?.total ?? 0
  const { appConfig, patchAppConfig } = useAppConfig()
  const { profileDisplayDate = 'expire' } = appConfig || {}
  const [updating, setUpdating] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [openInfoEditor, setOpenInfoEditor] = useState(false)
  const [openFileEditor, setOpenFileEditor] = useState(false)
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
  const [disableSelect, setDisableSelect] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const disableActionDisabled = switching || (isEnabled && !canDisable)
  const dragReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wasDraggingRef = useRef(false)

  const statusLabel = isCurrent ? '主用' : isEnabled ? '已合并' : '未合并'
  const statusClassName = isCurrent
    ? 'bg-yellow-400 text-black font-bold shadow-sm'
    : isEnabled
      ? 'bg-primary/20 text-primary font-medium shadow-none hover:bg-primary/30'
      : CARD_STYLES.MANAGEMENT_STATUS_INACTIVE

  const menuItems: MenuItem[] = useMemo(() => {
    const list = [
      {
        key: 'edit-info',
        label: '编辑属性',
        showDivider: false,
        color: 'default',
        className: ''
      } as MenuItem,
      {
        key: 'edit-file',
        label: '编辑内容',
        showDivider: false,
        color: 'default',
        className: ''
      } as MenuItem,
      {
        key: 'open-file',
        label: '使用外部程序打开',
        showDivider: true,
        color: 'default',
        className: ''
      } as MenuItem,
      {
        key: 'delete',
        label: '删除',
        showDivider: false,
        color: 'danger',
        className: 'text-danger'
      } as MenuItem
    ]
    if (info.home) {
      list.unshift({
        key: 'home',
        label: '主页',
        showDivider: false,
        color: 'default',
        className: ''
      } as MenuItem)
    }

    return list
  }, [info])

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
        openFile('profile', info.id)
        break
      }
      case 'delete': {
        setConfirmOpen(true)
        break
      }

      case 'home': {
        open(info.home)
        break
      }
    }
  }

  const onStatusAction = async (key: Key): Promise<void> => {
    setSelecting(true)
    try {
      switch (key) {
        case 'primary': {
          await onSetPrimary()
          break
        }
        case 'enabled': {
          await onToggleEnabled(true)
          break
        }
        case 'disabled': {
          await onToggleEnabled(false)
          break
        }
      }
    } finally {
      setSelecting(false)
    }
  }

  const statusControl = (
    <Dropdown placement="bottom-start">
      <DropdownTrigger>
        <Button
          size="sm"
          radius="full"
          variant={isCurrent || isEnabled ? 'solid' : 'bordered'}
          className={`${CARD_STYLES.MANAGEMENT_STATUS_BUTTON} ${statusClassName}`}
          isDisabled={switching}
        >
          {statusLabel}
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        onAction={(key) => void onStatusAction(key)}
        selectedKeys={[isCurrent ? 'primary' : isEnabled ? 'enabled' : 'disabled']}
        disabledKeys={[
          ...(isCurrent ? ['primary'] : []),
          ...(isEnabled ? ['enabled'] : []),
          ...(!isEnabled ? ['disabled'] : []),
          ...(disableActionDisabled ? ['disabled'] : [])
        ]}
      >
        <DropdownItem key="primary">
          设为主用
        </DropdownItem>
        <DropdownItem key="enabled">加入合并</DropdownItem>
        <DropdownItem key="disabled" description={disableActionDisabled ? '至少保留一个启用订阅' : undefined}>
          取消合并
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  )

  useEffect(() => {
    if (dragReleaseTimerRef.current) {
      clearTimeout(dragReleaseTimerRef.current)
      dragReleaseTimerRef.current = null
    }

    if (isDragging) {
      wasDraggingRef.current = true
      setDisableSelect(true)
      return
    }

    if (wasDraggingRef.current) {
      dragReleaseTimerRef.current = setTimeout(() => {
        setDisableSelect(false)
        dragReleaseTimerRef.current = null
      }, 100)
      wasDraggingRef.current = false
    }

    return () => {
      if (dragReleaseTimerRef.current) {
        clearTimeout(dragReleaseTimerRef.current)
        dragReleaseTimerRef.current = null
      }
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
          isRemote={info.type === 'remote'}
          onClose={() => setOpenFileEditor(false)}
        />
      )}
      {openInfoEditor && (
        <EditInfoModal
          item={info}
          isCurrent={isCurrent}
          onClose={() => setOpenInfoEditor(false)}
          updateProfileItem={updateProfileItem}
        />
      )}
      {confirmOpen && (
        <ConfirmModal
          onChange={setConfirmOpen}
          title="确认删除配置？"
          confirmText="确认删除"
          cancelText="取消"
          onConfirm={() => {
            removeProfileItem(info.id)
            mutateProfileConfig()
          }}
        />
      )}
      <Card
        as="div"
        fullWidth
        isPressable
        onPress={() => {
          if (disableSelect || switching) return
          setSelecting(true)
          onClick().finally(() => {
            setSelecting(false)
          })
        }}
        className={`
          ${CARD_STYLES.BASE}
          ${
            isCurrent
              ? CARD_STYLES.ACTIVE
              : isEnabled
                ? CARD_STYLES.ACTIVE_SECONDARY
              : CARD_STYLES.INACTIVE
          }
        `}
      >
        {selecting && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 rounded-xl">
            <Spinner size="sm" />
          </div>
        )}
        <div ref={setNodeRef} {...attributes} {...listeners} className="w-full h-full">
          <CardBody className="pb-1 overflow-hidden">
            <div className="flex min-h-[32px] items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3
                  title={info?.name}
                  className={CARD_STYLES.MANAGEMENT_TITLE}
                >
                  {info?.name}
                </h3>
              </div>
              <div className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                {info.type === 'remote' && (
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    color="default"
                    disabled={updating}
                    onPress={async () => {
                      setUpdating(true)
                      await addProfileItem(info)
                      setUpdating(false)
                    }}
                  >
                    <IoMdRefresh
                      color="default"
                      className={`${CARD_STYLES.MANAGEMENT_ACTION_ICON} ${updating ? 'animate-spin' : ''}`}
                    />
                  </Button>
                )}

                <Dropdown>
                  <DropdownTrigger>
                    <Button isIconOnly size="sm" variant="light" color="default">
                      <IoMdMore
                        color="default"
                        className={CARD_STYLES.MANAGEMENT_ACTION_ICON}
                      />
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
            {info.type === 'remote' && extra && (
              <div
                className={`mt-2 flex justify-between ${CARD_STYLES.MANAGEMENT_META_TEXT}`}
              >
                <small>{`${calcTraffic(usage)}/${calcTraffic(total)}`}</small>
                {profileDisplayDate === 'expire' ? (
                  <Button
                    size="sm"
                    variant="light"
                    className={CARD_STYLES.MANAGEMENT_META_BUTTON}
                    onPress={async () => {
                      await patchAppConfig({ profileDisplayDate: 'update' })
                    }}
                  >
                    {extra.expire ? dayjs.unix(extra.expire).format('YYYY-MM-DD') : '长期有效'}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="light"
                    className={CARD_STYLES.MANAGEMENT_META_BUTTON}
                    onPress={async () => {
                      await patchAppConfig({ profileDisplayDate: 'expire' })
                    }}
                  >
                    {dayjs(info.updated).fromNow()}
                  </Button>
                )}
              </div>
            )}
          </CardBody>
          <CardFooter className="pt-0">
            <div className="mt-2 flex w-full flex-col gap-2">
              <div className={CARD_STYLES.MANAGEMENT_FOOTER_ROW} onClick={(e) => e.stopPropagation()}>
                {statusControl}
                {info.type === 'remote' && !extra && (
                  <small>{dayjs(info.updated).fromNow()}</small>
                )}
              </div>
              {extra && (
                <TrafficProgress
                  value={calcPercent(extra?.upload, extra?.download, extra?.total)}
                  isActive={isEnabled}
                />
              )}
            </div>
          </CardFooter>
        </div>
      </Card>
    </div>
  )
}

export default ProfileItem
