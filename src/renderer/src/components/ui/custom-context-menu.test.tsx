// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { CustomContextMenu, ContextMenuItem } from './custom-context-menu'

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  DOMRect.fromRect ??= (rect = {}) => new DOMRect(rect.x, rect.y, rect.width, rect.height)
  HTMLElement.prototype.scrollIntoView ??= vi.fn()
})
afterEach(cleanup)

it('opens on right click, selects with the keyboard and closes on Escape', async () => {
  const select = vi.fn()
  render(
    <CustomContextMenu
      items={
        <>
          <ContextMenuItem disabled>不可用</ContextMenuItem>
          <ContextMenuItem onSelect={select}>复制</ContextMenuItem>
        </>
      }
    >
      <div>资源内容</div>
    </CustomContextMenu>
  )
  fireEvent.contextMenu(screen.getByText('资源内容'), { clientX: 900, clientY: 600 })
  const menu = await screen.findByRole('menu')
  fireEvent.keyDown(menu, { key: 'ArrowDown' })
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: '复制' }))
  )
  fireEvent.keyDown(document.activeElement!, { key: 'Enter' })
  await waitFor(() => expect(select).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  fireEvent.contextMenu(screen.getByText('资源内容'))
  fireEvent.keyDown(await screen.findByRole('menu'), { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
})

it('portals inside the current dialog and closes when its trigger scrolls', async () => {
  render(
    <div role="dialog">
      <CustomContextMenu items={<ContextMenuItem>复制</ContextMenuItem>}>
        <div>编辑器</div>
      </CustomContextMenu>
    </div>
  )
  fireEvent.contextMenu(screen.getByText('编辑器'))
  expect(screen.getByRole('dialog').contains(await screen.findByRole('menu'))).toBe(true)
  await act(async () => fireEvent.scroll(screen.getByText('编辑器')))
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
})
