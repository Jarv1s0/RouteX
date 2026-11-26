// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import UpdaterButton from './updater-button'

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
  )
}))

vi.mock('@renderer/api/app', () => ({
  cancelUpdate: vi.fn()
}))

vi.mock('@renderer/i18n', () => ({
  useI18n: () => ({
    t: (key: string, values?: Record<string, string | number>) =>
      values?.version ? `${key}:${values.version}` : key
  })
}))

vi.mock('@renderer/utils/ipc-channels', () => ({
  ON: { updateStatus: 'updateStatus' },
  onIpc: () => () => undefined
}))

vi.mock('./updater-modal', () => ({
  default: ({ version }: { version: string }) => <div data-testid="updater-modal">{version}</div>
}))

describe('UpdaterButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders nothing when latest is absent', () => {
    const { container } = render(<UpdaterButton />)
    expect(container.firstChild).toBeNull()
  })

  it('renders frosted update button and opens modal on press', async () => {
    render(<UpdaterButton latest={{ version: '4.7.0', releaseNotes: 'notes' }} compact />)

    const button = screen.getByRole('button', { name: 'sidebar.newVersion:4.7.0' })
    expect(button.className).toContain('rounded-xl')

    fireEvent.click(button)
    expect(await screen.findByTestId('updater-modal')).toBeTruthy()
  })
})
