// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useConnectionTable } from './use-connection-table'

const mocks = vi.hoisted(() => ({
  config: {} as Partial<AppConfig>,
  patch: vi.fn(),
  notify: vi.fn()
}))
vi.mock('@renderer/hooks/use-app-config', () => ({
  useAppConfig: () => ({ appConfig: mocks.config, patchAppConfig: mocks.patch })
}))
vi.mock('@renderer/utils/notify', () => ({ notifyError: mocks.notify }))
vi.mock('@renderer/i18n', () => ({ translate: (key: string) => key }))

function connection(id: string, download: number, process = 'browser'): ControllerConnectionDetail {
  return {
    id,
    download,
    upload: 0,
    start: '2026-11-18T00:00:00Z',
    metadata: { process }
  } as ControllerConnectionDetail
}
const data = [
  connection('a', 20, 'same'),
  connection('b', 10, 'same'),
  connection('c', 30, 'other')
]
beforeEach(() => {
  mocks.config = { connectionOrderBy: 'download', connectionDirection: 'asc' }
  mocks.patch.mockReset().mockResolvedValue(undefined)
  mocks.notify.mockReset()
})
afterEach(cleanup)

describe('connection table state', () => {
  it('sorts once through the table model and restores ordered multi-sort', () => {
    const { result, rerender } = renderHook(() => useConnectionTable(data))
    expect(result.current.getRowModel().rows.map((row) => row.id)).toEqual(['b', 'a', 'c'])
    mocks.config = {
      connectionOrderBy: 'process',
      connectionDirection: 'asc',
      connectionTableSorting: [
        { id: 'process', desc: false },
        { id: 'download', desc: true }
      ]
    }
    rerender()
    expect(result.current.getRowModel().rows.map((row) => row.id)).toEqual(['c', 'a', 'b'])
    act(() => result.current.getColumn('upload')?.toggleSorting(false, true))
    expect(mocks.patch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        connectionTableSorting: [
          { id: 'process', desc: false },
          { id: 'download', desc: true },
          { id: 'upload', desc: false }
        ]
      })
    )
  })
  it('restores visibility/order and computes fixed-column widths from the same model', () => {
    mocks.config = {
      connectionTableColumns: ['host', 'process', 'download'],
      connectionTableColumnWidths: { host: 210 },
      connectionTablePinning: { start: ['host', 'process'], end: [] }
    }
    const { result } = renderHook(() => useConnectionTable(data))
    expect(result.current.getVisibleLeafColumns().map((column) => column.id)).toEqual([
      'host',
      'process',
      'download'
    ])
    expect(result.current.getColumn('process')?.getStart('start')).toBe(210)
    act(() => result.current.getColumn('download')?.pin('end'))
    expect(mocks.patch).toHaveBeenCalledWith({
      connectionTablePinning: { start: ['host', 'process'], end: ['download'] }
    })
    act(() => result.current.getColumn('process')?.toggleVisibility(false))
    expect(mocks.patch).toHaveBeenCalledWith({ connectionTableColumns: ['host', 'download'] })
    expect(mocks.patch).not.toHaveBeenCalledWith(
      expect.objectContaining({ connectionTableColumnWidths: expect.anything() })
    )
  })
  it('persists column resize only at release and restores widths after a save failure', async () => {
    const { result } = renderHook(() => useConnectionTable(data))
    act(() =>
      result.current.setColumnResizing((previous) => ({ ...previous, isResizingColumn: 'host' }))
    )
    act(() => result.current.setColumnSizing({ host: 280 }))
    expect(mocks.patch).not.toHaveBeenCalled()
    mocks.patch.mockRejectedValueOnce(new Error('disk full'))
    act(() =>
      result.current.setColumnResizing((previous) => ({ ...previous, isResizingColumn: false }))
    )
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledTimes(1))
    expect(result.current.getColumn('host')?.getSize()).toBe(200)
    act(() => result.current.setColumnSizing({ host: 280 }))
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(2))
    expect(mocks.patch).toHaveBeenLastCalledWith({ connectionTableColumnWidths: { host: 280 } })
  })
  it('handles no visible columns and ignores stale sorting columns', () => {
    mocks.config = {
      connectionTableColumns: [],
      connectionTableSorting: [{ id: 'removed', desc: false }]
    }
    const { result } = renderHook(() => useConnectionTable(data))
    expect(result.current.getVisibleLeafColumns()).toEqual([])
    expect(result.current.state.sorting).toEqual([{ id: 'time', desc: false }])
  })
  it('adopts widths from background refresh without saving stale local widths', async () => {
    mocks.config = { connectionTableColumnWidths: { host: 210 } }
    const { result, rerender } = renderHook(() => useConnectionTable(data))
    mocks.config = { connectionTableColumnWidths: { host: 350 } }
    rerender()
    await waitFor(() => expect(result.current.getColumn('host')?.getSize()).toBe(350))
    expect(mocks.patch).not.toHaveBeenCalled()
  })
  it('persists reset widths explicitly so recursive config merging clears old overrides', async () => {
    mocks.config = { connectionTableColumnWidths: { host: 350 } }
    const { result } = renderHook(() => useConnectionTable(data))
    act(() => result.current.getColumn('host')?.resetSize())
    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith({ connectionTableColumnWidths: { host: 200 } })
    )
    expect(result.current.getColumn('host')?.getSize()).toBe(200)
  })
})
