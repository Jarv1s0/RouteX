import React, {
  useCallback,
  useMemo,
  type CSSProperties,
  type ComponentPropsWithoutRef
} from 'react'
import { HiSortAscending, HiSortDescending } from 'react-icons/hi'
import { IoPinOutline } from 'react-icons/io5'
import { TableVirtuoso } from 'react-virtuoso'
import { useI18n } from '@renderer/i18n'
import type { ConnectionTableInstance } from '@renderer/hooks/use-connection-table'
import { COLUMN_LABEL_KEYS, RIGHT_ALIGN_COLUMNS } from './columns'
import { ConnectionRow } from './connection-row'

type TableContext = { totalWidth: number; selectedId?: string }
function VirtualTable({
  context,
  style,
  ...props
}: ComponentPropsWithoutRef<'table'> & { context?: TableContext }) {
  return (
    <table
      {...props}
      style={{
        ...style,
        width: context?.totalWidth,
        tableLayout: 'fixed',
        borderCollapse: 'separate',
        borderSpacing: 0
      }}
    />
  )
}
const TABLE_COMPONENTS = { Table: VirtualTable }
interface Props {
  table: ConnectionTableInstance
  connections: ControllerConnectionDetail[]
  selected: ControllerConnectionDetail | undefined
  setSelected: React.Dispatch<React.SetStateAction<ControllerConnectionDetail | undefined>>
  setIsDetailModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  close: (id: string) => void
  iconMap: Record<string, string>
  appNameCache: Record<string, string>
  displayIcon: boolean
  displayAppName: boolean
  onContextMenu?: (conn: ControllerConnectionDetail, event: React.MouseEvent) => void
  onVisibleRangeChange?: (range: { startIndex: number; endIndex: number }) => void
  hiddenRules?: Set<string>
  timeRefreshTrigger?: number
}
function ConnectionTableComponent({
  table,
  connections,
  selected,
  setSelected,
  setIsDetailModalOpen,
  close,
  iconMap,
  appNameCache,
  displayIcon,
  displayAppName,
  onContextMenu,
  onVisibleRangeChange,
  hiddenRules,
  timeRefreshTrigger
}: Props) {
  const { t, locale } = useI18n()
  const columns = table.getVisibleLeafColumns()
  const layout = useMemo(() => {
    const widths: Record<string, number> = {}
    const styles: Record<string, CSSProperties> = {}
    for (const column of columns) {
      const pinned = column.getIsPinned()
      widths[column.id] = column.getSize()
      styles[column.id] = {
        width: column.getSize(),
        minWidth: column.getSize(),
        maxWidth: column.getSize(),
        position: pinned ? 'sticky' : 'relative',
        insetInlineStart: pinned === 'start' ? column.getStart('start') : undefined,
        insetInlineEnd: pinned === 'end' ? column.getAfter('end') : undefined,
        zIndex: pinned ? 2 : undefined,
        backgroundColor: pinned ? 'hsl(var(--heroui-content1))' : undefined
      }
    }
    return { ids: columns.map((column) => column.id), widths, styles }
  }, [columns, table.state.columnSizing, table.state.columnPinning])
  const handleRowClick = useCallback(
    (connection: ControllerConnectionDetail) => {
      setSelected(connection)
      setIsDetailModalOpen(true)
    },
    [setSelected, setIsDetailModalOpen]
  )
  const handleClose = useCallback((id: string) => close(id), [close])
  if (!columns.length)
    return <div className="p-4 text-sm text-foreground/75">{t('connections.table.noColumns')}</div>
  return (
    <div className="h-full w-full min-w-0">
      <TableVirtuoso
        data={connections}
        context={{ totalWidth: table.getTotalSize(), selectedId: selected?.id }}
        components={TABLE_COMPONENTS}
        computeItemKey={(_index, connection) => connection.id}
        overscan={10}
        rangeChanged={onVisibleRangeChange}
        fixedHeaderContent={() => (
          <tr>
            {table.getHeaderGroups()[0]?.headers.map((header) => {
              const column = header.column
              const direction = column.getIsSorted()
              const pin = column.getIsPinned()
              const pinTitle =
                pin === false
                  ? t('connections.table.pinStart')
                  : pin === 'start'
                    ? t('connections.table.pinEnd')
                    : t('connections.table.unpin')
              return (
                <th
                  key={header.id}
                  scope="col"
                  aria-sort={
                    direction ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'
                  }
                  className="group relative px-3 py-2 text-start text-sm font-medium bg-content1 select-none"
                  style={{ ...layout.styles[column.id], zIndex: pin ? 4 : 3 }}
                >
                  <div
                    className={`flex items-center gap-1 ${RIGHT_ALIGN_COLUMNS.includes(column.id) ? 'justify-end' : ''}`}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 items-center gap-1 rounded focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default"
                      disabled={!column.getCanSort()}
                      title={t('connections.table.multiSort')}
                      onClick={column.getToggleSortingHandler()}
                    >
                      <span className="truncate">{t(COLUMN_LABEL_KEYS[column.id])}</span>
                      {direction && (
                        <>
                          {direction === 'asc' ? (
                            <HiSortAscending className="shrink-0 text-primary" />
                          ) : (
                            <HiSortDescending className="shrink-0 text-primary" />
                          )}
                          {table.state.sorting.length > 1 && (
                            <span className="text-[10px] text-primary">
                              {column.getSortIndex() + 1}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label={pinTitle}
                      title={pinTitle}
                      className={`shrink-0 rounded p-0.5 focus-visible:ring-2 focus-visible:ring-primary ${pin ? 'text-primary' : 'text-foreground/65 hover:text-foreground opacity-0 group-hover:opacity-100 focus:opacity-100'}`}
                      onClick={() =>
                        column.pin(pin === false ? 'start' : pin === 'start' ? 'end' : false)
                      }
                    >
                      <IoPinOutline size={12} />
                    </button>
                  </div>
                  {column.getCanResize() && (
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={t('connections.table.resize')}
                      tabIndex={0}
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none focus-visible:bg-primary"
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      onDoubleClick={() => column.resetSize()}
                      onKeyDown={(event) => {
                        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                          event.preventDefault()
                          table.setColumnSizing((previous) => ({
                            ...previous,
                            [column.id]: Math.max(
                              40,
                              column.getSize() + (event.key === 'ArrowLeft' ? -10 : 10)
                            )
                          }))
                        }
                      }}
                    />
                  )}
                </th>
              )
            })}
          </tr>
        )}
        itemContent={(_index, connection, context) => (
          <ConnectionRow
            conn={connection}
            isSelected={context.selectedId === connection.id}
            onRowClick={handleRowClick}
            onClose={handleClose}
            timeRefreshTrigger={timeRefreshTrigger}
            visibleColumns={layout.ids}
            columnWidths={layout.widths}
            columnStyles={layout.styles}
            iconMap={iconMap}
            appNameCache={appNameCache}
            displayIcon={displayIcon}
            displayAppName={displayAppName}
            onContextMenu={onContextMenu}
            hiddenRules={hiddenRules}
            t={t}
            locale={locale}
          />
        )}
      />
    </div>
  )
}
export default ConnectionTableComponent
