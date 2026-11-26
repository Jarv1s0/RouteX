// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AppSidebar from './AppSidebar'

const mocks = vi.hoisted(() => ({
  navigateSidebarRoute: vi.fn(),
  preloadSidebarRoute: vi.fn(),
  pathname: '/proxies'
}))

vi.mock('@heroui/react', () => ({
  Button: ({
    children,
    onPress,
    isIconOnly: _isIconOnly,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    onPress?: () => void
    isIconOnly?: boolean
  }) => (
    <button type="button" onClick={onPress} {...props}>
      {children}
    </button>
  ),
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: mocks.pathname })
}))

vi.mock('@renderer/routes', () => ({
  navigateSidebarRoute: mocks.navigateSidebarRoute,
  preloadSidebarRoute: mocks.preloadSidebarRoute
}))

vi.mock('@renderer/hooks/use-app-config', () => ({
  useAppConfig: () => ({ appConfig: { useWindowFrame: false } })
}))

vi.mock('@renderer/utils/init', () => ({
  platform: 'win32'
}))

vi.mock('@renderer/i18n', () => ({
  useI18n: () => ({
    t: (key: string, values?: Record<string, string | number>) =>
      values?.version ? `${key}:${values.version}` : key
  })
}))

vi.mock('@renderer/components/sider/outbound-mode-switcher', () => ({
  default: () => <div data-testid="outbound-mode-switcher" />
}))
vi.mock('@renderer/components/sider/proxy-card', () => ({
  default: () => <div data-testid="proxy-card" />
}))
vi.mock('@renderer/components/sider/conn-card', () => ({
  default: () => <div data-testid="conn-card" />
}))
vi.mock('@renderer/components/sider/profile-card', () => ({
  default: () => <div data-testid="profile-card" />
}))
vi.mock('@renderer/components/sider/rule-card', () => ({
  default: () => <div data-testid="rule-card" />
}))
vi.mock('@renderer/components/sider/mihomo-core-card', () => ({
  default: () => <div data-testid="mihomo-core-card" />
}))
vi.mock('@renderer/components/sider/stats-card', () => ({
  default: () => <div data-testid="stats-card" />
}))
vi.mock('@renderer/components/sider/map-card', () => ({
  default: () => <div data-testid="map-card" />
}))
vi.mock('@renderer/components/sider/log-card', () => ({
  default: () => <div data-testid="log-card" />
}))
vi.mock('@renderer/components/sider/tools-card', () => ({
  default: () => <div data-testid="tools-card" />
}))
vi.mock('@renderer/components/sider/sidebar-nameplate', () => ({
  default: ({ latest }: { latest?: { version: string } }) => (
    <div data-testid="sidebar-nameplate" data-latest-version={latest?.version ?? ''} />
  )
}))
vi.mock('@renderer/components/updater/updater-button', () => ({
  default: ({ latest }: { latest?: { version: string } }) => (
    <button type="button" data-testid="updater-button">
      {latest?.version}
    </button>
  )
}))

describe('AppSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.pathname = '/proxies'
  })

  afterEach(() => {
    cleanup()
  })

  it('removes top-left brand/settings row, puts settings in nav group, and forwards latest to nameplate', () => {
    render(
      <AppSidebar
        width={250}
        narrowWidth={60}
        latest={{ version: '4.7.0', releaseNotes: 'notes' }}
      />
    )

    expect(screen.queryByRole('heading', { name: 'RouteX' })).toBeNull()
    expect(screen.getByText('sidebar.settings')).toBeTruthy()
    expect(screen.getByTestId('sidebar-nameplate').getAttribute('data-latest-version')).toBe(
      '4.7.0'
    )

    fireEvent.click(screen.getByText('sidebar.settings'))
    expect(mocks.navigateSidebarRoute).toHaveBeenCalledWith('/settings')
  })

  it('keeps bottom settings button in narrow mode', () => {
    render(<AppSidebar width={60} narrowWidth={60} />)

    fireEvent.click(screen.getByTitle('sidebar.settings'))
    expect(mocks.navigateSidebarRoute).toHaveBeenCalledWith('/settings')
  })
})
