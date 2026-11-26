// @vitest-environment jsdom
import React from 'react'
import { HeroUIProvider } from '@heroui/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Mihomo from './mihomo'

const mocks = vi.hoisted(() => ({
  dnsEditor: {
    changed: false,
    saveDisabled: false,
    saving: false,
    save: vi.fn()
  },
  snifferEditor: {
    changed: false,
    saveDisabled: false,
    saving: false,
    save: vi.fn()
  }
}))

vi.stubGlobal('__ROUTEX_HOST__', 'tauri')
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
    appConfig: { core: 'mihomo', corePermissionMode: 'elevated' },
    patchAppConfig: vi.fn()
  })
}))
vi.mock('@renderer/hooks/use-controled-mihomo-config', () => ({
  useControledMihomoConfig: () => ({ controledMihomoConfig: { ipv6: false } })
}))
vi.mock('@renderer/hooks/use-mihomo-latest-version', () => ({
  useMihomoLatestVersion: () => ''
}))
vi.mock('@renderer/utils/init', () => ({ platform: 'win32', version: '4.6.0' }))
vi.mock('@renderer/utils/mihomo-ipc', () => ({
  ensureMihomoCoreAvailable: vi.fn(),
  mihomoUpgrade: vi.fn(),
  mihomoVersion: vi.fn(),
  restartCore: vi.fn()
}))
vi.mock('@renderer/utils/service-ipc', () => ({
  manualGrantCorePermition: vi.fn(),
  revokeCorePermission: vi.fn(),
  deleteElevateTask: vi.fn(),
  checkElevateTask: vi.fn(),
  installService: vi.fn(),
  uninstallService: vi.fn(),
  startService: vi.fn(),
  stopService: vi.fn(),
  initService: vi.fn(),
  restartService: vi.fn()
}))
vi.mock('@renderer/api/app', () => ({
  relaunchApp: vi.fn(),
  notDialogQuit: vi.fn(),
  patchAppConfig: vi.fn()
}))
vi.mock('@renderer/utils/core-restart', () => ({ applyConfigChange: vi.fn() }))
vi.mock('@renderer/utils/notify', () => ({
  notifyError: vi.fn(),
  notifyInfo: vi.fn(),
  notifySuccess: vi.fn()
}))
vi.mock('@renderer/utils/mihomo-version', () => ({ hasMihomoUpdate: () => false }))
vi.mock('@renderer/utils/mihomo-core-events', () => ({ emitMihomoCoreChanged: vi.fn() }))
vi.mock('@renderer/utils/mihomo-core-switch', () => ({ switchMihomoCore: vi.fn() }))
vi.mock('@renderer/components/base/base-page', () => ({
  FLOATING_ACTION_BUTTON_CLASS: 'floating-action-btn-test',
  default: ({
    title,
    footer,
    children
  }: React.PropsWithChildren<{ title?: React.ReactNode; footer?: React.ReactNode }>) => (
    <div>
      <div data-testid="page-title">{title}</div>
      <div>{children}</div>
      <div data-testid="page-footer">{footer}</div>
    </div>
  )
}))
vi.mock('@renderer/components/mihomo/port-setting', () => ({
  default: () => <div data-testid="port-setting" />
}))
vi.mock('@renderer/components/mihomo/controller-setting', () => ({
  default: () => <div data-testid="controller-setting" />
}))
vi.mock('@renderer/components/mihomo/env-setting', () => ({
  default: () => <div data-testid="env-setting" />
}))
vi.mock('@renderer/components/mihomo/advanced-settings', () => ({
  default: () => <div data-testid="advanced-setting" />
}))
vi.mock('@renderer/components/mihomo/permission-modal', () => ({ default: () => null }))
vi.mock('@renderer/components/mihomo/service-modal', () => ({ default: () => null }))
vi.mock('@renderer/components/base/base-confirm', () => ({ default: () => null }))
vi.mock('@renderer/hooks/use-dns-form', () => ({
  useDnsSettingsEditor: () => mocks.dnsEditor
}))
vi.mock('@renderer/components/dns/dns-settings-editor', () => ({
  DnsSettingsFormFields: () => <div data-testid="dns-form" />
}))
vi.mock('@renderer/components/sniffer/sniffer-settings-editor', () => ({
  useSnifferSettingsEditor: () => mocks.snifferEditor,
  SnifferSettingsFormFields: () => <div data-testid="sniffer-form" />
}))

function renderMihomo(initialEntry = '/mihomo'): ReturnType<typeof render> {
  return render(
    <HeroUIProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/mihomo" element={<Mihomo />} />
        </Routes>
      </MemoryRouter>
    </HeroUIProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.dnsEditor.changed = false
  mocks.dnsEditor.saveDisabled = false
  mocks.dnsEditor.saving = false
  mocks.snifferEditor.changed = false
  mocks.snifferEditor.saveDisabled = false
  mocks.snifferEditor.saving = false
})

afterEach(cleanup)

it('renders basic, dns, and sniffer tabs and scopes the floating save button to the active editor tab', () => {
  mocks.dnsEditor.changed = true
  renderMihomo('/mihomo')

  expect(screen.getByTestId('port-setting')).toBeTruthy()
  expect(screen.queryByTestId('dns-form')).toBeNull()
  expect(screen.queryByTestId('sniffer-form')).toBeNull()
  expect(screen.queryByRole('button', { name: 'common.save' })).toBeNull()

  fireEvent.click(screen.getByRole('tab', { name: 'page.mihomo.dnsTab' }))
  expect(screen.getByTestId('dns-form')).toBeTruthy()
  const saveButton = screen.getByRole('button', { name: 'common.save' })
  expect(saveButton.className).toContain('floating-action-btn-test')
  fireEvent.click(saveButton)
  expect(mocks.dnsEditor.save).toHaveBeenCalledTimes(1)

  fireEvent.click(screen.getByRole('tab', { name: 'page.mihomo.snifferTab' }))
  expect(screen.getByTestId('sniffer-form')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'common.save' })).toBeNull()
})

it('opens directly on the requested tab query parameter', () => {
  mocks.snifferEditor.changed = true
  renderMihomo('/mihomo?tab=sniffer')

  expect(screen.getByTestId('sniffer-form')).toBeTruthy()
  const saveButton = screen.getByRole('button', { name: 'common.save' })
  fireEvent.click(saveButton)
  expect(mocks.snifferEditor.save).toHaveBeenCalledTimes(1)
})
