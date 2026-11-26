// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SidebarNameplate from './sidebar-nameplate'

const mocks = vi.hoisted(() => ({
  mihomoConfig: { mode: 'rule' as OutboundMode } as {
    mode?: OutboundMode
  }
}))

vi.mock('@renderer/hooks/use-controled-mihomo-config', () => ({
  useControledMihomoConfig: () => ({ controledMihomoConfig: mocks.mihomoConfig })
}))

vi.mock('@renderer/utils/init', () => ({
  version: '4.6.0'
}))

vi.mock('@renderer/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@renderer/components/updater/updater-button', () => ({
  default: ({ latest, compact }: { latest?: { version: string }; compact?: boolean }) =>
    latest?.version ? (
      <button type="button" data-testid="nameplate-updater" data-compact={String(Boolean(compact))}>
        {latest.version}
      </button>
    ) : null
}))

describe('SidebarNameplate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    mocks.mihomoConfig = { mode: 'rule' }
  })

  afterEach(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    cleanup()
  })

  it('renders minimal brand nameplate without status badge or header edit button', () => {
    render(<SidebarNameplate />)

    expect(screen.getByText('RouteX')).toBeTruthy()
    expect(screen.getByText('v4.6.0')).toBeTruthy()
    expect(screen.queryByText('sidebar.nameplate.statusGuarding')).toBeNull()
    expect(screen.queryByLabelText('sidebar.nameplate.editSignature')).toBeNull()
    expect(screen.queryByTestId('nameplate-updater')).toBeNull()
  })

  it('renders compact updater button on the right when latest is provided', () => {
    render(<SidebarNameplate latest={{ version: '4.7.0', releaseNotes: 'notes' }} />)

    const updater = screen.getByTestId('nameplate-updater')
    expect(updater.getAttribute('data-compact')).toBe('true')
    expect(updater.textContent).toBe('4.7.0')
  })

  it('allows double-clicking signature to edit without opening on single click', () => {
    render(<SidebarNameplate />)

    const signatureRow = screen.getByRole('button')
    fireEvent.click(signatureRow)
    expect(screen.queryByLabelText('sidebar.nameplate.signaturePlaceholder')).toBeNull()

    fireEvent.doubleClick(signatureRow)
    const input = screen.getByLabelText(
      'sidebar.nameplate.signaturePlaceholder'
    ) as HTMLInputElement
    fireEvent.change(input, { target: { value: '  Keep shipping calmly  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByText('Keep shipping calmly')).toBeTruthy()
    expect(window.localStorage.getItem('routex.sidebar.nameplate.signature')).toBe(
      'Keep shipping calmly'
    )

    // 双击已有签名进入编辑，按 Esc 取消修改
    fireEvent.doubleClick(screen.getByText('Keep shipping calmly'))
    const secondInput = screen.getByLabelText(
      'sidebar.nameplate.signaturePlaceholder'
    ) as HTMLInputElement
    fireEvent.change(secondInput, { target: { value: 'Unsaved change' } })
    fireEvent.keyDown(secondInput, { key: 'Escape' })

    expect(screen.getByText('Keep shipping calmly')).toBeTruthy()

    // 再次双击签名并重置恢复默认问候语
    fireEvent.doubleClick(screen.getByText('Keep shipping calmly'))
    fireEvent.click(screen.getByLabelText('sidebar.nameplate.resetSignature'))

    expect(window.localStorage.getItem('routex.sidebar.nameplate.signature')).toBeNull()
    expect(screen.queryByText('Keep shipping calmly')).toBeNull()
  })

  it('switches ambient phrase in direct mode', () => {
    mocks.mihomoConfig = { mode: 'direct' }
    render(<SidebarNameplate />)

    expect(screen.getByText('sidebar.nameplate.phraseDirect')).toBeTruthy()
  })
})
