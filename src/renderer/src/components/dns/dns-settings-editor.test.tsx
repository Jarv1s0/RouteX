// @vitest-environment jsdom
import React from 'react'
import { HeroUIProvider } from '@heroui/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useDnsSettingsEditor } from '@renderer/hooks/use-dns-form'
import { DnsSettingsFormFields } from './dns-settings-editor'

const configs = vi.hoisted(() => ({
  app: { controlDns: true },
  core: { dns: { listen: '127.0.0.1:53' } }
}))
vi.mock('@renderer/hooks/use-app-config', () => ({
  useAppConfig: () => ({ appConfig: configs.app })
}))
vi.mock('@renderer/hooks/use-controled-mihomo-config', () => ({
  useControledMihomoConfig: () => ({ controledMihomoConfig: configs.core })
}))
vi.mock('@renderer/utils/core-restart', () => ({ applyConfigChange: vi.fn() }))
vi.mock('@renderer/utils/notify', () => ({ notifyError: vi.fn() }))
vi.mock('@renderer/utils/init', () => ({ platform: 'win32', version: '' }))
vi.mock('@renderer/components/settings/advanced-settings', () => ({
  primaryInputClassNames: {},
  secondaryInputClassNames: {},
  selectClassNames: {}
}))
vi.mock('@renderer/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
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
  vi.restoreAllMocks()
  cleanup()
})

it.each([
  { controlDns: true, saving: false },
  { controlDns: false, saving: false },
  { controlDns: true, saving: true }
])('opens DNS and advanced fields without hanging (%j)', ({ controlDns, saving }) => {
  configs.app.controlDns = controlDns
  const originalHas = Set.prototype.has
  let checks = 0
  // React Aria's all-disabled tab traversal loops synchronously, so a test timeout
  // cannot interrupt it. Bound key lookups to turn that regression into a failure.
  vi.spyOn(Set.prototype, 'has').mockImplementation(function (this: Set<unknown>, key) {
    if (
      [
        'fake-ip',
        'redir-host',
        'normal',
        'blacklist',
        'whitelist',
        'rule',
        'default',
        'arc',
        'lru'
      ].includes(String(key))
    ) {
      if (++checks > 10000) {
        throw new Error('DNS tabs exceeded the disabled-key traversal limit')
      }
    }
    return originalHas.call(this, key)
  })
  let renders = 0
  function Editor(): React.ReactNode {
    if (++renders > 30) throw new Error('DNS editor exceeded 30 renders during mount')
    const editor = useDnsSettingsEditor()
    return <DnsSettingsFormFields editor={{ ...editor, saving }} />
  }
  render(
    <HeroUIProvider>
      <Editor />
    </HeroUIProvider>
  )
  expect(screen.getByDisplayValue('127.0.0.1:53')).toBeTruthy()
  fireEvent.click(screen.getByText('dns.more'))
  expect(screen.getAllByRole('tab')).toHaveLength(9)
  for (const tab of screen.getAllByRole('tab')) {
    expect(tab.getAttribute('aria-disabled') === 'true').toBe(!controlDns || saving)
  }
  if (!controlDns || saving) {
    fireEvent.click(screen.getByRole('tab', { name: 'dns.redirHost' }))
    expect(screen.getByRole('tab', { name: 'dns.fakeIp' }).getAttribute('aria-selected')).toBe(
      'true'
    )
  } else {
    fireEvent.click(screen.getByRole('tab', { name: 'dns.redirHost' }))
    expect(screen.getByRole('tab', { name: 'dns.redirHost' }).getAttribute('aria-selected')).toBe(
      'true'
    )
  }
  if (!controlDns) {
    fireEvent.click(screen.getAllByRole('switch')[0])
    expect(
      screen.getByRole('tab', { name: 'dns.redirHost' }).getAttribute('aria-disabled')
    ).not.toBe('true')
    fireEvent.click(screen.getByRole('tab', { name: 'dns.redirHost' }))
    expect(screen.getByRole('tab', { name: 'dns.redirHost' }).getAttribute('aria-selected')).toBe(
      'true'
    )
  }
  expect(renders).toBeLessThan(30)
})
