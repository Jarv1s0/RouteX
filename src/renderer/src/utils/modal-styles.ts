import { platform } from '@renderer/utils/init'
import type { CSSProperties } from 'react'

type ModalClassNames = Partial<
  Record<'base' | 'backdrop' | 'wrapper' | 'header' | 'body' | 'footer' | 'closeButton', string>
>

function mergeClassNames(...classes: Array<string | undefined>): string | undefined {
  const merged = classes.filter(Boolean).join(' ')
  return merged || undefined
}

const MODAL_SURFACE_BASE_CLASSNAME =
  'mx-0 sm:mx-0 my-4 sm:my-8 max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-4rem)] rounded-[22px] bg-background/90 dark:bg-default-100/88 backdrop-blur-xl border border-default-300/75 dark:border-white/15 shadow-[0_24px_56px_-12px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.75)] dark:shadow-[0_28px_64px_-12px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.1)]'

export const SECONDARY_MODAL_CLOSE_BUTTON_CLASSNAME =
  'top-3.5 right-4 h-7 w-7 min-w-7 rounded-full bg-transparent text-default-400 transition-all duration-150 hover:bg-danger/12 hover:text-danger active:scale-95 active:bg-danger/18 dark:text-default-500'

export const SECONDARY_MODAL_ICON_CLOSE_BUTTON_CLASSNAME =
  'app-nodrag h-7 w-7 min-w-7 rounded-full bg-transparent text-default-400 transition-all duration-150 hover:bg-danger/12 hover:text-danger active:scale-95 active:bg-danger/18 dark:text-default-500'

export const SECONDARY_MODAL_HEADER_CLASSNAME =
  'flex items-center justify-between gap-3 app-drag px-6 pt-5 pb-3'

export const MAIN_PANE_MODAL_CLASSNAMES: ModalClassNames = {
  base: `max-w-none w-full ${MODAL_SURFACE_BASE_CLASSNAME}`,
  backdrop: '!left-[var(--sider-width,0px)] bg-black/40 backdrop-blur-[2px]',
  closeButton: SECONDARY_MODAL_CLOSE_BUTTON_CLASSNAME
}

export function createSecondaryModalClassNames(overrides: ModalClassNames = {}): ModalClassNames {
  return {
    base: mergeClassNames(MODAL_SURFACE_BASE_CLASSNAME, overrides.base),
    backdrop: mergeClassNames('!left-[var(--sider-width,0px)]', overrides.backdrop),
    wrapper: overrides.wrapper,
    header: overrides.header,
    body: overrides.body,
    footer: overrides.footer,
    closeButton: mergeClassNames(SECONDARY_MODAL_CLOSE_BUTTON_CLASSNAME, overrides.closeButton)
  }
}

interface MainPaneModalContentStyleOptions {
  collapseSidebar?: boolean
  siderWidth?: number
  maxWidthPx?: number
  viewportPaddingPx?: number
}

export function getMainPaneModalContentStyle(
  options: MainPaneModalContentStyleOptions = {}
): CSSProperties {
  const { collapseSidebar = false, siderWidth = 220, maxWidthPx, viewportPaddingPx = 32 } = options
  const narrowWidth = platform === 'darwin' ? 70 : 60
  const activeSidebarWidth = collapseSidebar ? narrowWidth : siderWidth
  const widthExpression = `calc(100vw - ${activeSidebarWidth}px - ${viewportPaddingPx * 2}px)`

  return {
    width: maxWidthPx ? `min(${maxWidthPx}px, ${widthExpression})` : widthExpression,
    maxWidth: 'none',
    marginLeft: `${activeSidebarWidth}px`
  }
}
