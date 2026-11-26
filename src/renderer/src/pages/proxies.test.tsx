// @vitest-environment jsdom
import React from 'react'
import { HeroUIProvider } from '@heroui/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Proxies from './proxies'

function makeGroup(name: string, nowName: string): ControllerMixedGroup {
  return {
    alive: true,
    extra: {},
    history: [],
    interface: '',
    mptcp: false,
    smux: false,
    tfo: false,
    udp: true,
    uot: false,
    xudp: false,
    name,
    type: 'Selector',
    now: nowName,
    all: [
      {
        id: nowName,
        name: nowName,
        type: 'Shadowsocks',
        history: [{ time: '2026-11-25T00:00:00Z', delay: 90 }],
        extra: {},
        alive: true,
        tfo: false,
        xudp: false,
        udp: true,
        uot: false,
        mptcp: false,
        smux: false,
        'dialer-proxy': '',
        'routing-mark': 0,
        interface: ''
      }
    ],
    hidden: false,
    icon: ''
  }
}

const mocks = vi.hoisted(() => ({
  groups: [makeGroup('Proxy', 'US-01'), makeGroup('AI', 'JP-01')]
}))

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
)

vi.mock('@renderer/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
  translate: (key: string) => key
}))
vi.mock('@renderer/hooks/use-app-config', () => ({
  useAppConfig: () => ({
    appConfig: {
      proxyDisplayLayout: 'double',
      proxyDisplayOrder: 'default',
      autoCloseConnection: true,
      proxyCols: 'auto',
      groupOrder: [],
      autoDelayTestOnShow: false,
      delayTestConcurrency: 4
    }
  })
}))
vi.mock('@renderer/store/use-app-store', () => ({
  useAppStore: (
    selector: (state: {
      appConfig?: { delayThresholds?: { good: number; fair: number } }
    }) => unknown
  ) => selector({ appConfig: { delayThresholds: { good: 200, fair: 500 } } })
}))
vi.mock('@renderer/hooks/use-controled-mihomo-config', () => ({
  useControledMihomoConfig: () => ({ controledMihomoConfig: { mode: 'rule' } })
}))
vi.mock('@renderer/hooks/use-groups', () => ({
  useGroups: () => ({ groups: mocks.groups, mutate: vi.fn(), isLoading: false })
}))
vi.mock('@renderer/hooks/use-proxy-delay-runner', () => ({
  useProxyDelayRunner: () => ({
    delaying: {},
    runDelayTargets: vi.fn(),
    onChangeProxy: vi.fn(),
    onProxyDelay: vi.fn(),
    onGroupDelay: vi.fn(),
    delayOpenedGroup: vi.fn()
  })
}))
vi.mock('@renderer/hooks/use-proxy-auto-delay', () => ({
  useProxyAutoDelay: vi.fn()
}))
vi.mock('@renderer/utils/init', () => ({ platform: 'win32', version: '4.6.0' }))
vi.mock('@renderer/utils/resource-ipc', () => ({ getImageDataURL: vi.fn() }))
vi.mock('@renderer/components/base/base-page', () => ({
  default: ({ title, children }: React.PropsWithChildren<{ title?: React.ReactNode }>) => (
    <div>
      <div>{title}</div>
      <div>{children}</div>
    </div>
  )
}))
vi.mock('@renderer/components/proxies/proxy-setting-modal', () => ({ default: () => null }))
vi.mock('@renderer/components/proxies/proxy-item', () => ({
  default: ({ proxy }: { proxy: { name: string } }) => (
    <div data-testid="drawer-node">{proxy.name}</div>
  )
}))
vi.mock('react-virtuoso', () => ({
  Virtuoso: ({
    data,
    itemContent
  }: {
    data: unknown[]
    itemContent: (index: number, item: unknown) => React.ReactNode
  }) => <div>{data.map((item, index) => itemContent(index, item))}</div>
}))

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)

it('switches drawer directly when clicking another card without closing first, and closes on blank click', () => {
  const { container } = render(
    <HeroUIProvider>
      <Proxies />
    </HeroUIProvider>
  )

  expect(screen.queryByRole('complementary')).toBeNull()

  fireEvent.click(screen.getByText('Proxy'))
  const proxyDrawer = screen.getByRole('complementary', { name: 'Proxy' })
  expect(proxyDrawer.className).toContain('shrink-0')
  expect(proxyDrawer.className).not.toContain('absolute')
  expect(screen.getByTestId('drawer-node').textContent).toBe('US-01')

  // Clicking another card directly switches the drawer without needing to close first
  fireEvent.click(screen.getByText('AI'))
  expect(screen.getByRole('complementary', { name: 'AI' })).toBeTruthy()
  expect(screen.getByTestId('drawer-node').textContent).toBe('JP-01')

  // Search bar is collapsed by default and expands from the header icon button
  expect(screen.queryByPlaceholderText('page.proxies.searchNodes')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'page.proxies.searchNodes' }))
  const searchInput = screen.getByPlaceholderText('page.proxies.searchNodes')
  fireEvent.change(searchInput, { target: { value: 'missing' } })
  expect(screen.queryByTestId('drawer-node')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'page.proxies.searchNodes' }))
  expect(screen.queryByPlaceholderText('page.proxies.searchNodes')).toBeNull()
  expect(screen.getByTestId('drawer-node').textContent).toBe('JP-01')

  // Clicking blank space outside cards closes the drawer
  const scrollContainer = container.querySelector('.custom-scrollbar')
  expect(scrollContainer).toBeTruthy()
  fireEvent.click(scrollContainer as Element)
  expect(screen.getByRole('complementary', { name: 'AI' }).className).toContain('pointer-events-none')
})
