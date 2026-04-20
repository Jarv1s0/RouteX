import {
  Button,
  Card,
  CardBody,
  CardFooter,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Spinner,
  Tooltip
} from '@heroui/react'
import TrafficProgress from '@renderer/components/base/traffic-progress'
import { calcPercent, calcTraffic } from '@renderer/utils/calc'
import { IoMdMore, IoMdRefresh } from 'react-icons/io'
import dayjs from 'dayjs'
import React, { Key, useEffect, useMemo, useState } from 'react'
import EditFileModal from './edit-file-modal'
import EditInfoModal from './edit-info-modal'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { openFile } from '@renderer/utils/file-ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import ConfirmModal from '../base/base-confirm'

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
  isDisabled?: boolean
  description?: string
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
  const mergeActionDisabled = switching || (isEnabled && !canDisable)

  const menuItems: MenuItem[] = useMemo(() => {
    const list = [
      {
        key: 'edit-info',
        label: '编辑信息',
        showDivider: false,
        color: 'default',
        className: ''
      } as MenuItem,
      {
        key: 'edit-file',
        label: '编辑文件',
        showDivider: false,
        color: 'default',
        className: ''
      } as MenuItem,
      {
        key: 'open-file',
        label: '打开文件',
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

    if (isEnabled) {
      list.unshift({
        key: 'remove-merge',
        label: '移出合并',
        showDivider: true,
        color: 'default',
        className: '',
        isDisabled: mergeActionDisabled
      } as MenuItem)
    } else {
      list.unshift({
        key: 'join-merge',
        label: '加入合并',
        showDivider: true,
        color: 'default',
        className: '',
        isDisabled: switching
      } as MenuItem)
    }

    if (isEnabled && !isCurrent) {
      list.unshift({
        key: 'set-primary',
        label: '设为主订阅',
        showDivider: false,
        color: 'default',
        className: '',
        isDisabled: switching
      } as MenuItem)
    }

    return list
  }, [info, isCurrent, isEnabled, canDisable, mergeActionDisabled, switching])

  const onMenuAction = async (key: Key): Promise<void> => {
    switch (key) {
      case 'join-merge': {
        void runSelectionAction(() => onToggleEnabled(true), switching)
        break
      }
      case 'remove-merge': {
        void runSelectionAction(() => onToggleEnabled(false), mergeActionDisabled)
        break
      }
      case 'set-primary': {
        void runSelectionAction(onSetPrimary, switching || isCurrent || !isEnabled)
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

  useEffect(() => {
    if (isDragging) {
      setTimeout(() => {
        setDisableSelect(true)
      }, 100)
    } else {
      setTimeout(() => {
        setDisableSelect(false)
      }, 100)
    }
  }, [isDragging])

  const runSelectionAction = async (
    action: () => Promise<void>,
    isDisabled: boolean
  ): Promise<void> => {
    if (isDisabled) return
    setSelecting(true)
    try {
      await action()
    } finally {
      setSelecting(false)
    }
  }

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
                  className="text-ellipsis whitespace-nowrap overflow-hidden text-md font-bold leading-[32px] text-foreground"
                >
                  {info?.name}
                </h3>
              </div>
              <div className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                {isCurrent && (
                  <div className="flex h-8 items-center">
                    <Chip
                      size="sm"
                      variant="solid"
                      className="shrink-0 bg-yellow-400 text-black font-bold shadow-sm"
                    >
                      主用
                    </Chip>
                  </div>
                )}
                {!isCurrent && isEnabled && (
                  <div className="flex h-8 items-center">
                    <Tooltip content={canDisable ? '点击移出合并' : '至少保留一个启用订阅'}>
                      <Button
                        size="sm"
                        disableRipple
                        isDisabled={mergeActionDisabled}
                        className="h-6 px-2.5 min-w-0 bg-primary/20 text-primary font-medium shadow-none text-[12px] rounded-full hover:bg-primary/30"
                        onPress={() => {
                          void runSelectionAction(() => onToggleEnabled(false), mergeActionDisabled)
                        }}
                      >
                        已合并
                      </Button>
                    </Tooltip>
                  </div>
                )}
                {info.type === 'remote' && (
                  <Tooltip placement="left" content={dayjs(info.updated).fromNow()}>
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
                        className={`text-foreground text-[24px] ${updating ? 'animate-spin' : ''}`}
                      />
                    </Button>
                  </Tooltip>
                )}

                <Dropdown>
                  <DropdownTrigger>
                    <Button isIconOnly size="sm" variant="light" color="default">
                      <IoMdMore
                        color="default"
                        className={`text-[24px] text-foreground`}
                      />
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu
                    onAction={onMenuAction}
                    disabledKeys={menuItems.filter(i => i.isDisabled).map(i => i.key)}
                  >
                    {menuItems.map((item) => (
                      <DropdownItem
                        showDivider={item.showDivider}
                        key={item.key}
                        color={item.color}
                        className={item.className}
                        description={item.description}
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
                className={`mt-2 flex justify-between text-foreground`}
              >
                <small>{`${calcTraffic(usage)}/${calcTraffic(total)}`}</small>
                {profileDisplayDate === 'expire' ? (
                  <Button
                    size="sm"
                    variant="light"
                    className={`h-[20px] p-1 m-0 text-foreground`}
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
                    className={`h-[20px] p-1 m-0 text-foreground`}
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
            {info.type === 'remote' && !extra && (
              <div
                className={`w-full mt-2 flex justify-between text-foreground`}
              >
                <Chip
                  size="sm"
                  variant="bordered"
                  className={`border-primary text-primary`}
                >
                  远程
                </Chip>
                <small>{dayjs(info.updated).fromNow()}</small>
              </div>
            )}
            {info.type === 'local' && (
              <div
                className={`mt-2 flex justify-between text-foreground`}
              >
                <Chip
                  size="sm"
                  variant="bordered"
                  className={`border-primary text-primary`}
                >
                  本地
                </Chip>
              </div>
            )}
            {extra && (
              <TrafficProgress
                value={calcPercent(extra?.upload, extra?.download, extra?.total)}
                isActive={isEnabled}
              />
            )}
          </CardFooter>
        </div>
      </Card>
    </div>
  )
}

export default ProfileItem
