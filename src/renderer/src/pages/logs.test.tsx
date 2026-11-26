// @vitest-environment jsdom
import React from 'react'
import { HeroUIProvider } from '@heroui/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Logs from './logs'
import { formatDisplayLogTime, parseLogPayload } from '@renderer/utils/log-styles'

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

it('filters logs by module chip, exclusion syntax, and regex toggle', () => {
  mocks.config = { 'log-level': 'debug' }
  mocks.logs = [
    { type: 'debug', payload: '[DNS] cp.cloudflare.com --> [1.1.1.1]', time: '2026/11/19 11:26:04' },
    { type: 'info', payload: '[TCP] 198.18.0.1:8424(Weixin.exe) --> 61.151.230.226:80 using DIRECT', time: '2026/11/19 11:26:05' },
    { type: 'debug', payload: '[Sniffer] All sniffing sniff failed', time: '2026/11/19 11:26:06' }
  ]
  render(page())

  fireEvent.click(screen.getByRole('button', { name: 'DNS' }))
  expect(screen.queryAllByTestId('log').map((row) => row.textContent)).toEqual([
    '[DNS] cp.cloudflare.com --> [1.1.1.1]'
  ])

  fireEvent.click(screen.getByRole('button', { name: 'page.logs.allModules' }))
  const searchInput = screen.getByPlaceholderText('common.search')
  fireEvent.change(searchInput, { target: { value: '-Sniffer' } })
  expect(screen.queryAllByTestId('log').map((row) => row.textContent)).toEqual([
    '[DNS] cp.cloudflare.com --> [1.1.1.1]',
    '[TCP] 198.18.0.1:8424(Weixin.exe) --> 61.151.230.226:80 using DIRECT'
  ])

  fireEvent.click(screen.getByRole('button', { name: 'page.logs.regexSearch' }))
  fireEvent.change(searchInput, { target: { value: 'Weixin\\.exe.*DIRECT' } })
  expect(screen.queryAllByTestId('log').map((row) => row.textContent)).toEqual([
    '[TCP] 198.18.0.1:8424(Weixin.exe) --> 61.151.230.226:80 using DIRECT'
  ])
})

it('parses log module tags, process tokens, and short display timestamps', () => {
  expect(parseLogPayload('[TCP] 198.18.0.1:8424(Weixin.exe) --> 61.151.230.226:80')).toEqual({
    tag: 'TCP',
    rest: '198.18.0.1:8424(Weixin.exe) --> 61.151.230.226:80',
    quickFilterToken: 'Weixin.exe'
  })
  expect(parseLogPayload('[DNS] hijack udp:198.18.0.2:53')).toEqual({
    tag: 'DNS',
    rest: 'hijack udp:198.18.0.2:53',
    quickFilterToken: 'DNS'
  })
  expect(formatDisplayLogTime('2026/11/19 11:26:04')).toBe('11:26:04')
  expect(formatDisplayLogTime('2026/11/19 11:26:04', '11:26:04.123')).toBe('11:26:04.123')
})
