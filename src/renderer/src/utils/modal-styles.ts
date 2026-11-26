import { CARD_STYLES } from '@renderer/utils/card-styles'
import { platform } from '@renderer/utils/init'
import type { CSSProperties } from 'react'

type ModalClassNames = Partial<
  Record<'base' | 'backdrop' | 'wrapper' | 'header' | 'body' | 'footer' | 'closeButton', string>
>

function mergeClassNames(...classes: Array<string | undefined>): string | undefined {
  const merged = classes.filter(Boolean).join(' ')
  return merged || undefined
}

export const SECONDARY_MODAL_CLOSE_BUTTON_CLASSNAME =
  'top-3 right-3 h-7 w-7 min-w-7 rounded-full bg-transparent text-default-400 transition-all duration-150 hover:bg-danger/12 hover:text-danger active:scale-95 active:bg-danger/18 dark:text-default-500'

export const SECONDARY_MODAL_ICON_CLOSE_BUTTON_CLASSNAME =
  'app-nodrag h-7 w-7 min-w-7 rounded-full bg-transparent text-default-400 transition-all duration-150 hover:bg-danger/12 hover:text-danger active:scale-95 active:bg-danger/18 dark:text-default-500'

export const SECONDARY_MODAL_HEADER_CLASSNAME =
  'flex items-center justify-between gap-3 app-drag pl-6 pr-4 pt-4 pb-2'

export const MAIN_PANE_MODAL_CLASSNAMES: ModalClassNames = {
  base: `max-w-none w-full ${CARD_STYLES.GLASS_CARD} shadow-2xl`,
  backdrop: '!left-[var(--sider-width,0px)] bg-black/40 backdrop-blur-[2px]',
  closeButton: SECONDARY_MODAL_CLOSE_BUTTON_CLASSNAME
}

export function createSecondaryModalClassNames(overrides: ModalClassNames = {}): ModalClassNames {
  return {
    base: mergeClassNames(`${CARD_STYLES.GLASS_CARD} shadow-2xl`, overrides.base),
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
