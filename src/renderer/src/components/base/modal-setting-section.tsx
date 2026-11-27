import React from 'react'
import { CARD_STYLES } from '@renderer/utils/card-styles'

export const MODAL_SECTION_INPUT_CLASSNAMES = {
  ...CARD_STYLES.FORM_INPUT,
  inputWrapper: `${CARD_STYLES.FORM_INPUT.inputWrapper} !bg-default-100/80 dark:!bg-white/[0.06] !border-default-200/85 dark:!border-white/12 !shadow-none group-data-[hover=true]:!bg-default-100 dark:group-data-[hover=true]:!bg-white/10 group-data-[focus=true]:!bg-white dark:group-data-[focus=true]:!bg-default-100/60 group-data-[focus=true]:!border-primary/60`
}

export const MODAL_SECTION_NUMBER_INPUT_CLASSNAMES = {
  ...MODAL_SECTION_INPUT_CLASSNAMES,
  input: `${MODAL_SECTION_INPUT_CLASSNAMES.input} [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]`
}

export const MODAL_SECTION_SELECT_CLASSNAMES = {
  ...CARD_STYLES.FORM_SELECT,
  trigger: `${CARD_STYLES.FORM_SELECT.trigger} !bg-default-100/80 dark:!bg-white/[0.06] !border-default-200/85 dark:!border-white/12 !shadow-none data-[hover=true]:!bg-default-100 dark:data-[hover=true]:!bg-white/10 data-[open=true]:!bg-white dark:data-[open=true]:!bg-default-100/80`
}

export const MODAL_SECTION_TABS_CLASSNAMES = {
  ...CARD_STYLES.GLASS_TABS,
  tabList:
    'bg-default-200/65 dark:bg-white/[0.07] border border-default-200/80 dark:border-white/12 p-0.5 overflow-visible rounded-full',
  cursor: 'w-full bg-white dark:bg-default-200 shadow-sm rounded-full',
  tabContent:
    'font-medium text-default-600 dark:text-default-400 group-data-[selected=true]:text-primary group-data-[selected=true]:font-semibold transition-colors',
  tab: 'h-7 px-3'
}

export const MODAL_SETTING_MODAL_OVERRIDES = {
  base: 'rounded-[18px]',
  closeButton: 'top-2.5 right-2.5'
}

export const MODAL_SETTING_HEADER_CLASSNAME =
  'flex items-center justify-between gap-3 app-drag px-3.5 pt-3 pb-1.5 text-base font-semibold'

export const MODAL_SETTING_BODY_CLASSNAME = 'flex flex-col gap-2.5 px-2.5 pt-0 pb-2.5'

export const ModalSettingSection: React.FC<{
  title?: string
  children: React.ReactNode
}> = ({ title, children }) => (
  <section className="flex flex-col gap-1">
    {title && (
      <h3 className="px-1.5 text-xs font-semibold tracking-wide text-default-600 dark:text-default-400">
        {title}
      </h3>
    )}
    <div className="rounded-[12px] border border-default-200/85 bg-white/95 shadow-[0_1px_2px_rgba(15,23,42,0.04)] divide-y divide-default-200/70 dark:border-white/12 dark:bg-zinc-900/60 dark:shadow-[0_2px_8px_rgba(0,0,0,0.28)] dark:divide-white/10">
      {children}
    </div>
  </section>
)

export const ModalSettingRow: React.FC<{
  title: string
  titleActions?: React.ReactNode
  hint?: React.ReactNode
  children: React.ReactNode
}> = ({ title, titleActions, hint, children }) => (
  <div className="px-3.5 py-2.5">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className="text-sm font-medium leading-snug text-foreground">{title}</span>
        {titleActions}
        {hint && <span className="text-xs leading-snug text-foreground-400">{hint}</span>}
      </div>
      <div className="flex shrink-0 items-center sm:justify-end">{children}</div>
    </div>
  </div>
)
