// @vitest-environment jsdom
import React from 'react'
import { HeroUIProvider } from '@heroui/react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ProfileSettingModal from './profile-setting-modal'

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
)

const mocks = vi.hoisted(() => ({
  patchAppConfig: vi.fn().mockResolvedValue(undefined),
  getUserAgent: vi.fn().mockResolvedValue('RouteX-Tauri/4.6.0'),
  getGistUrl: vi.fn().mockResolvedValue('https://gist.github.com/user/123'),
  writeText: vi.fn().mockResolvedValue(undefined),
  toastSuccess: vi.fn(),
  toastInfo: vi.fn(),
  appConfig: {
    collapseSidebar: false,
    siderWidth: 220,
    profileDisplayDate: 'update' as const,
    userAgent: 'Custom-UA/1.0',
    diffWorkDir: false,
    githubToken: 'ghp_secret'
  }
}))

vi.mock('@renderer/i18n', () => ({
  useI18n: () => ({
    t: (key: string, values?: Record<string, string | number>) =>
      values ? `${key}:${JSON.stringify(values)}` : key
  })
}))

vi.mock('@renderer/utils/init', () => ({ platform: 'win32', version: '4.6.0' }))
vi.mock('@renderer/utils/notify', () => ({ notifyError: vi.fn() }))
vi.mock('@renderer/api/app', () => ({ getUserAgent: mocks.getUserAgent }))
vi.mock('@renderer/utils/profile-ipc', () => ({ getGistUrl: mocks.getGistUrl }))
vi.mock('sonner', () => ({
  toast: {
    success: mocks.toastSuccess,
    info: mocks.toastInfo
  }
}))
vi.mock('@renderer/hooks/use-app-config', () => ({
  useAppConfig: () => ({
    appConfig: mocks.appConfig,
    patchAppConfig: mocks.patchAppConfig
  })
}))

function renderModal(): void {
  render(
    <HeroUIProvider>
      <ProfileSettingModal onClose={vi.fn()} />
    </HeroUIProvider>
  )
}

describe('ProfileSettingModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.patchAppConfig.mockResolvedValue(undefined)
    mocks.getUserAgent.mockResolvedValue('RouteX-Tauri/4.6.0')
    mocks.getGistUrl.mockResolvedValue('https://gist.github.com/user/123')
    mocks.writeText.mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: {
        writeText: mocks.writeText
      }
    })
  })

  afterEach(cleanup)

  it('commits UA and GitHub token on blur and supports resetting UA and toggling token visibility', async () => {
    renderModal()

    const uaInput = screen.getByLabelText('profiles.userAgent') as HTMLInputElement
    expect(uaInput.value).toBe('Custom-UA/1.0')
    fireEvent.change(uaInput, { target: { value: 'New-UA/2.0' } })
    fireEvent.blur(uaInput)
    expect(mocks.patchAppConfig).toHaveBeenCalledWith({ userAgent: 'New-UA/2.0' })

    fireEvent.click(screen.getByRole('button', { name: 'proxies.resetToDefault' }))
    expect(mocks.patchAppConfig).toHaveBeenCalledWith({ userAgent: '' })

    const tokenInput = screen.getByLabelText('profiles.syncGist') as HTMLInputElement
    expect(tokenInput.type).toBe('password')
    fireEvent.click(screen.getByRole('button', { name: 'profiles.showToken' }))
    expect(tokenInput.type).toBe('text')

    fireEvent.change(tokenInput, { target: { value: 'ghp_updated' } })
    fireEvent.blur(tokenInput)
    expect(mocks.patchAppConfig).toHaveBeenCalledWith({ githubToken: 'ghp_updated' })
  })

  it('copies gist raw URL or shows info toast when gist URL is unavailable', async () => {
    renderModal()

    fireEvent.click(screen.getByRole('button', { name: 'profiles.copyGistUrl' }))
    await waitFor(() => {
      expect(mocks.writeText).toHaveBeenCalledWith(
        'https://gist.github.com/user/123/raw/routex.yaml'
      )
      expect(mocks.toastSuccess).toHaveBeenCalledWith('common.copied')
    })

    mocks.getGistUrl.mockResolvedValueOnce('')
    fireEvent.click(screen.getByRole('button', { name: 'profiles.copyGistUrl' }))
    await waitFor(() => {
      expect(mocks.toastInfo).toHaveBeenCalledWith('profiles.gistUrlUnavailable')
    })
  })
})
