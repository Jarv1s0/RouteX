// @vitest-environment jsdom
import React from 'react'
import { HeroUIProvider } from '@heroui/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ProxyGroupCard } from './proxy-group-card'

vi.mock('@renderer/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
  translate: (key: string) => key
}))
vi.mock('@renderer/utils/resource-ipc', () => ({ getImageDataURL: vi.fn() }))
vi.mock('@renderer/store/use-app-store', () => ({
  useAppStore: (
    selector: (state: {
      appConfig?: { delayThresholds?: { good: number; fair: number } }
    }) => unknown
  ) => selector({ appConfig: { delayThresholds: { good: 200, fair: 500 } } })
}))

const sampleGroup: ControllerMixedGroup = {
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
  name: 'AI',
  type: 'Selector',
  now: 'US-Node',
  all: [
    {
      id: 'US-Node',
      name: 'US-Node',
      type: 'Shadowsocks',
      history: [{ time: '2026-11-25T00:00:00Z', delay: 120 }],
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

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)

it('renders grid card and triggers group delay without opening drawer', () => {
  const onOpen = vi.fn()
  const onGroupDelay = vi.fn().mockResolvedValue(undefined)

  render(
    <HeroUIProvider>
      <ProxyGroupCard
        group={sampleGroup}
        active={false}
        onOpen={onOpen}
        delaying={false}
        currentDelay={120}
        liveCount={1}
        onGroupDelay={onGroupDelay}
      />
    </HeroUIProvider>
  )

  expect(screen.getByText('AI')).toBeTruthy()
  expect(screen.getByTitle('US-Node')).toBeTruthy()
  expect(screen.getByText('120')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'proxies.testGroup' }))
  expect(onGroupDelay).toHaveBeenCalledTimes(1)
  expect(onOpen).not.toHaveBeenCalled()

  fireEvent.click(screen.getByText('AI'))
  expect(onOpen).toHaveBeenCalledTimes(1)
})
