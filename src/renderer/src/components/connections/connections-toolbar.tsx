import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
  Select,
  SelectItem,
  Tab,
  Tabs
} from '@heroui/react'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import type {
  ConnectionOrderBy,
  ConnectionTab,
  ConnectionViewMode
} from '@renderer/components/connections/shared'
import { CgClose, CgTrash } from 'react-icons/cg'
import { HiSortAscending, HiSortDescending } from 'react-icons/hi'
import {
  IoApps,
  IoEye,
  IoEyeOff,
  IoGrid,
  IoList,
  IoPause,
  IoPlay,
  IoPulseOutline,
  IoTimeOutline
} from 'react-icons/io5'

interface ConnectionsToolbarProps {
  activeCount: number
  closedCount: number
  tab: ConnectionTab
  viewMode: ConnectionViewMode
  filter: string
  connectionOrderBy: ConnectionOrderBy
  connectionDirection: 'asc' | 'desc'
  isPaused: boolean
  showHidden: boolean
  hiddenRulesCount: number
  setFilter: React.Dispatch<React.SetStateAction<string>>
  setViewMode: React.Dispatch<React.SetStateAction<ConnectionViewMode>>
  setPaused: (paused: boolean) => void
  setShowHidden: React.Dispatch<React.SetStateAction<boolean>>
  onTabChange: (tab: ConnectionTab) => void
  onOrderByChange: (orderBy: ConnectionOrderBy) => Promise<void>
  onDirectionToggle: () => Promise<void>
  onBulkAction: () => void
  onClearAllHidden: () => void
}

const VIEW_MODE_ICONS: Record<ConnectionViewMode, React.ReactNode> = {
  table: <IoGrid className="text-lg" />,
  list: <IoList className="text-lg" />,
  group: <IoApps className="text-lg" />
}

const COUNT_BADGE_CLASS =
  'text-[11px] font-medium leading-none tabular-nums text-current'

export default function ConnectionsToolbar({
  activeCount,
  closedCount,
  tab,
  viewMode,
  filter,
  connectionOrderBy,
  connectionDirection,
  isPaused,
  showHidden,
  hiddenRulesCount,
  setFilter,
  setViewMode,
  setPaused,
  setShowHidden,
  onTabChange,
  onOrderByChange,
  onDirectionToggle,
  onBulkAction,
  onClearAllHidden
}: ConnectionsToolbarProps): React.ReactNode {
  return (
    <div className="overflow-x-auto sticky top-0 z-40 w-full pb-2 px-2 pt-2 pointer-events-none">
      <div
        className={`flex items-center w-full px-2 py-1.5 gap-2 pointer-events-auto ${CARD_STYLES.GLASS_TOOLBAR} ${CARD_STYLES.ROUNDED}`}
      >
        <Tabs
          size="md"
          variant="solid"
          radius="lg"
          selectedKey={tab}
          onSelectionChange={(key) => onTabChange(key as ConnectionTab)}
          classNames={CARD_STYLES.GLASS_TABS}
        >
          <Tab
            key="active"
            title={
              <div className="flex items-center gap-2 px-2">
                <IoPulseOutline className="text-lg" />
                <span>活动中</span>
                <span className={COUNT_BADGE_CLASS}>
                  {activeCount}
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
                {closedCount > 0 && (
                  <span className={COUNT_BADGE_CLASS}>
                    {closedCount}
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
          onSelectionChange={(keys) => {
            const orderBy = Array.from(keys)[0] as ConnectionOrderBy | undefined
            if (orderBy) {
              void onOrderByChange(orderBy)
            }
          }}
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

        <Button size="sm" isIconOnly className="bg-content2" onPress={() => void onDirectionToggle()}>
          {connectionDirection === 'asc' ? (
            <HiSortAscending className="text-lg" />
          ) : (
            <HiSortDescending className="text-lg" />
          )}
        </Button>

        <Dropdown>
          <DropdownTrigger>
            <Button size="sm" isIconOnly className="bg-content2">
              {VIEW_MODE_ICONS[viewMode]}
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="视图切换"
            selectionMode="single"
            selectedKeys={new Set([viewMode])}
            onSelectionChange={(keys) => {
              const nextViewMode = Array.from(keys)[0] as ConnectionViewMode | undefined
              if (nextViewMode) {
                setViewMode(nextViewMode)
              }
            }}
          >
            <DropdownItem key="list" startContent={<IoList />}>
              卡片视图
            </DropdownItem>
            <DropdownItem key="table" startContent={<IoGrid />}>
              表格视图
            </DropdownItem>
            <DropdownItem key="group" startContent={<IoApps />}>
              分组视图
            </DropdownItem>
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
          onPress={onBulkAction}
        >
          {tab === 'active' ? <CgClose className="text-lg" /> : <CgTrash className="text-lg" />}
        </Button>

        {hiddenRulesCount > 0 && (
          <>
            <Button
              size="sm"
              isIconOnly
              variant="flat"
              color={showHidden ? 'primary' : 'default'}
              title={
                showHidden
                  ? `隐藏已隐藏的连接 (${hiddenRulesCount} 规则)`
                  : `显示已隐藏的连接 (${hiddenRulesCount} 规则)`
              }
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
              onPress={onClearAllHidden}
            >
              <CgTrash className="text-lg" />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
