// @vitest-environment jsdom
import React from 'react'
import { HeroUIProvider } from '@heroui/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Logs from './logs'

const mocks = vi.hoisted(() => ({
  config: { 'log-level': 'info' } as Partial<MihomoConfig>,
  logs: [] as ControllerLog[],
  save: vi.fn(),
  apply: vi.fn()
}))
vi.mock('@renderer/utils/core-restart', () => ({ applyConfigChange: mocks.apply }))
vi.mock('@renderer/utils/file-ipc', () => ({ saveFile: mocks.save }))
vi.mock('@renderer/utils/notify', () => ({ notifyError: vi.fn() }))
vi.mock('@renderer/hooks/use-app-config', () => ({
  useAppConfig: () => ({ appConfig: {}, patchAppConfig: vi.fn() })
}))
vi.mock('@renderer/hooks/use-controled-mihomo-config', () => ({
  useControledMihomoConfig: () => ({ controledMihomoConfig: mocks.config })
}))
vi.mock('@renderer/store/use-logs-store', () => ({
  useLogsStore: (selector: (state: unknown) => unknown) =>
    selector({ logs: mocks.logs, paused: false, setPaused: vi.fn(), clearLogs: vi.fn() }),
  retainLogsListeners: vi.fn(),
  releaseLogsListeners: vi.fn(),
  retainLogsView: vi.fn(),
  releaseLogsView: vi.fn()
}))
vi.mock('@renderer/i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@renderer/components/base/base-page', () => ({
  default: ({ children }: React.PropsWithChildren) => <div>{children}</div>
}))
vi.mock('@renderer/components/logs/log-item', () => ({
  default: ({ payload }: ControllerLog) => <div data-testid="log">{payload}</div>
}))
vi.mock('@renderer/components/logs/log-detail-modal', () => ({ default: () => null }))
vi.mock('react-virtuoso', () => ({
  Virtuoso: ({
    data,
    itemContent
  }: {
    data: ControllerLog[]
    itemContent: (index: number, log: ControllerLog) => React.ReactNode
  }) => <div>{data.map((log, index) => itemContent(index, log))}</div>
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.config = { 'log-level': 'info' }
  mocks.logs = ['debug', 'info', 'warning', 'error'].map((type) => ({
    type: type as LogLevel,
    payload: `${type} message`,
    time: '2026/11/19 11:26:04'
  }))
})
afterEach(cleanup)

function page(): React.ReactNode {
  return (
    <HeroUIProvider>
      <Logs />
    </HeroUIProvider>
  )
}

it('refilters buffered and incoming logs whenever the configured level changes', () => {
  const view = render(page())
  for (const [level, expected] of [
    ['error', ['error message']],
    ['warning', ['warning message', 'error message']],
    ['info', ['info message', 'warning message', 'error message']],
    ['debug', ['debug message', 'info message', 'warning message', 'error message']],
    ['silent', []]
  ] as [LogLevel, string[]][]) {
    mocks.config = { 'log-level': level }
    view.rerender(page())
    expect(screen.queryAllByTestId('log').map((row) => row.textContent)).toEqual(expected)
  }
  mocks.config = { 'log-level': 'error' }
  mocks.logs = [
    ...mocks.logs,
    { type: 'info', payload: 'new info' },
    { type: 'error', payload: 'new error' }
  ]
  view.rerender(page())
  expect(screen.queryAllByTestId('log').map((row) => row.textContent)).toEqual([
    'error message',
    'new error'
  ])
})

it('combines severity with search and exports only the visible logs', () => {
  mocks.config = { 'log-level': 'error' }
  mocks.logs = [...mocks.logs, { type: 'error', payload: 'different failure' }]
  render(page())
  fireEvent.change(screen.getByPlaceholderText('common.search'), { target: { value: 'MESSAGE' } })
  expect(screen.queryAllByTestId('log').map((row) => row.textContent)).toEqual(['error message'])
  fireEvent.click(screen.getByTitle('page.logs.export'))
  expect(mocks.save).toHaveBeenCalledWith(
    '[2026/11/19 11:26:04] [ERROR] error message',
    expect.any(String),
    'txt'
  )
})
