import { CARD_STYLES } from '@renderer/utils/card-styles'

type ModalClassNames = Partial<
  Record<'base' | 'backdrop' | 'wrapper' | 'header' | 'body' | 'footer' | 'closeButton', string>
>

const MODAL_BORDER = 'border-default-200/60 dark:border-white/10'

function mergeClassNames(...classes: Array<string | undefined>): string | undefined {
  const merged = classes.filter(Boolean).join(' ')
  return merged || undefined
}

export const SECONDARY_MODAL_CLOSE_BUTTON_CLASSNAME =
  'top-3 right-3 h-8 w-8 min-w-8 rounded-full bg-default-100/70 text-default-500 shadow-sm transition-all duration-150 hover:bg-danger/12 hover:text-danger active:scale-95 active:bg-danger/18'

export const SECONDARY_MODAL_ICON_CLOSE_BUTTON_CLASSNAME =
  'app-nodrag h-8 w-8 min-w-8 rounded-full bg-default-100/70 text-default-500 shadow-sm transition-all duration-150 hover:bg-danger/12 hover:text-danger active:scale-95 active:bg-danger/18'

export const SECONDARY_MODAL_HEADER_CLASSNAME =
  'flex items-center justify-between gap-3 app-drag pl-6 pr-4 py-3'

export function createSecondaryModalClassNames(
  overrides: ModalClassNames = {}
): ModalClassNames {
  return {
    base: mergeClassNames(`${CARD_STYLES.GLASS_CARD} shadow-2xl`, overrides.base),
    backdrop: mergeClassNames('top-[48px]', overrides.backdrop),
    wrapper: overrides.wrapper,
    header: mergeClassNames(`border-b ${MODAL_BORDER}`, overrides.header),
    body: overrides.body,
    footer: mergeClassNames(`border-t ${MODAL_BORDER}`, overrides.footer),
    closeButton: mergeClassNames(SECONDARY_MODAL_CLOSE_BUTTON_CLASSNAME, overrides.closeButton)
  }
}
