// @vitest-environment jsdom
import React, { useState, useCallback } from 'react'
import { HeroUIProvider } from '@heroui/react'
import { VirtuosoMockContext } from 'react-virtuoso'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useConnectionTable } from '@renderer/hooks/use-connection-table'
import ConnectionTable from './connection-table'

const mocks = vi.hoisted(() => ({
  patch: vi.fn(),
  close: vi.fn(),
  open: vi.fn(),
  context: vi.fn()
}))
vi.mock('@renderer/hooks/use-app-config', () => ({
  useAppConfig: () => {
    const [appConfig, setConfig] = useState<Partial<AppConfig>>({
      connectionOrderBy: 'download',
      connectionDirection: 'asc',
      connectionTableColumns: ['host', 'download', 'close']
    })
    const patchAppConfig = useCallback(async (patch: Partial<AppConfig>) => {
      mocks.patch(patch)
      setConfig((previous) => ({ ...previous, ...patch }))
    }, [])
    return { appConfig, patchAppConfig }
  }
}))
vi.mock('@renderer/utils/notify', () => ({ notifyError: vi.fn() }))
vi.mock('@renderer/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'zh-CN' }),
  translate: (key: string) => key
}))
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
)
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
const data = Array.from({ length: 50 }, (_, index) => ({
  id: String(index),
  metadata: { host: `host-${index}.example` },
  upload: 0,
  download: index,
  start: '2026-11-18T00:00:00Z',
  isActive: true
})) as ControllerConnectionDetail[]

function Harness() {
  const table = useConnectionTable(data)
  return (
    <HeroUIProvider>
      <VirtuosoMockContext.Provider value={{ viewportHeight: 400, itemHeight: 40 }}>
        <ConnectionTable
          table={table}
          connections={table.getRowModel().rows.map((row) => row.original)}
          selected={undefined}
          setSelected={vi.fn()}
          setIsDetailModalOpen={mocks.open}
          close={mocks.close}
          iconMap={{}}
          appNameCache={{}}
          displayIcon={false}
          displayAppName={false}
          onContextMenu={mocks.context}
        />
      </VirtuosoMockContext.Provider>
    </HeroUIProvider>
  )
}

it('renders virtual rows and updates sort, pinning, and keyboard resizing without remounting', async () => {
  render(<Harness />)
  await screen.findByText('host-0.example')
  expect(screen.queryByText('host-49.example')).toBeNull()
  const hostHeader = screen.getByRole('columnheader', { name: /connections.column.host/ })
  fireEvent.click(within(hostHeader).getByRole('button', { name: 'connections.table.pinStart' }))
  await waitFor(() => expect(hostHeader.style.position).toBe('sticky'))
  fireEvent.keyDown(within(hostHeader).getByRole('separator'), { key: 'ArrowRight' })
  await waitFor(() => expect(hostHeader.style.width).toBe('210px'))
  expect(mocks.patch).toHaveBeenCalledWith({ connectionTableColumnWidths: { host: 210 } })
  fireEvent.click(screen.getByRole('button', { name: 'connections.column.download' }))
  await screen.findByText('host-49.example')
  expect(
    screen
      .getByRole('columnheader', { name: /connections.column.download/ })
      .getAttribute('aria-sort')
  ).toBe('descending')
})

it('keeps row details, context menus, and close actions independent', async () => {
  render(<Harness />)
  const host = await screen.findByText('host-0.example')
  fireEvent.contextMenu(host)
  expect(mocks.context).toHaveBeenCalledWith(
    expect.objectContaining({ id: '0' }),
    expect.anything()
  )
  expect(mocks.open).not.toHaveBeenCalled()
  const row = host.closest('tr')!
  fireEvent.click(within(row).getByRole('button', { name: 'connections.column.close' }))
  expect(mocks.close).toHaveBeenCalledWith('0')
  expect(mocks.open).not.toHaveBeenCalled()
  fireEvent.click(host)
  expect(mocks.open).toHaveBeenCalledWith(true)
})
