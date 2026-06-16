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
  IoEye,
  IoEyeOff,
  IoGrid,
  IoList,
  IoPause,
  IoPlay,
  IoPulseOutline,
  IoTimeOutline
} from 'react-icons/io5'
import { useI18n, type TranslationKey } from '@renderer/i18n'

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
  list: <IoList className="text-lg" />
}

const COUNT_BADGE_CLASS = 'text-[11px] font-medium leading-none tabular-nums text-current'

const ORDER_OPTIONS: {
  key: ConnectionOrderBy
  labelKey: TranslationKey
}[] = [
  { key: 'upload', labelKey: 'connections.order.upload' },
  { key: 'download', labelKey: 'connections.order.download' },
  { key: 'uploadSpeed', labelKey: 'connections.order.uploadSpeed' },
  { key: 'downloadSpeed', labelKey: 'connections.order.downloadSpeed' },
  { key: 'time', labelKey: 'connections.order.time' },
  { key: 'process', labelKey: 'connections.order.process' },
  { key: 'type', labelKey: 'connections.order.type' },
  { key: 'rule', labelKey: 'connections.order.rule' }
]

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
  const { t } = useI18n()

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
                <span>{t('connections.active')}</span>
                <span className={COUNT_BADGE_CLASS}>{activeCount}</span>
              </div>
            }
          />
          <Tab
            key="closed"
            title={
              <div className="flex items-center gap-2 px-2">
                <IoTimeOutline className="text-lg" />
                <span>{t('connections.closed')}</span>
                {closedCount > 0 && <span className={COUNT_BADGE_CLASS}>{closedCount}</span>}
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
          placeholder={t('common.filter')}
          isClearable
          onValueChange={setFilter}
        />

        <Select
          classNames={{
            ...CARD_STYLES.GLASS_SELECT,
            popoverContent: `${CARD_STYLES.GLASS_SELECT.popoverContent} min-w-[160px]`,
            listbox: 'min-w-[160px]'
          }}
          size="sm"
          className="w-[140px] min-w-[140px]"
          selectedKeys={new Set([connectionOrderBy])}
          disallowEmptySelection={true}
          onSelectionChange={(keys) => {
            const orderBy = Array.from(keys)[0] as ConnectionOrderBy | undefined
            if (orderBy) {
              void onOrderByChange(orderBy)
            }
          }}
        >
          {ORDER_OPTIONS.map((option) => (
            <SelectItem key={option.key} textValue={t(option.labelKey)}>
              {t(option.labelKey)}
            </SelectItem>
          ))}
        </Select>

        <Button
          size="sm"
          isIconOnly
          className="bg-content2"
          onPress={() => void onDirectionToggle()}
        >
          {connectionDirection === 'asc' ? (
            <HiSortAscending className="text-lg" />
          ) : (
            <HiSortDescending className="text-lg" />
          )}
        </Button>

        <Dropdown classNames={CARD_STYLES.GLASS_DROPDOWN}>
          <DropdownTrigger>
            <Button size="sm" isIconOnly className="bg-content2">
              {VIEW_MODE_ICONS[viewMode]}
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label={t('connections.viewSwitch')}
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
              {t('connections.cardView')}
            </DropdownItem>
            <DropdownItem key="table" startContent={<IoGrid />}>
              {t('connections.tableView')}
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>

        <Button
          size="sm"
          isIconOnly
          variant="flat"
          color={isPaused ? 'success' : 'warning'}
          title={isPaused ? t('connections.resume') : t('connections.pause')}
          onPress={() => setPaused(!isPaused)}
        >
          {isPaused ? <IoPlay className="text-lg" /> : <IoPause className="text-lg" />}
        </Button>

        <Button
          size="sm"
          isIconOnly
          variant="flat"
          color="danger"
          title={tab === 'active' ? t('connections.closeAll') : t('connections.clearRecords')}
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
                  ? t('connections.hideFiltered', { count: hiddenRulesCount })
                  : t('connections.showHidden', { count: hiddenRulesCount })
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
              title={t('connections.clearHidden')}
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
