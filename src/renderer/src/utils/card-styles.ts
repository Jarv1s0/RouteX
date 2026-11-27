const GLASS_POPOVER_CONTENT =
  'backdrop-blur-2xl backdrop-saturate-150 bg-white/88 dark:bg-zinc-900/82 rounded-2xl border border-default-200/70 dark:border-white/12 shadow-[0_12px_32px_-4px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.05)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.5)] animate-pop-in max-h-[300px] overflow-y-auto'
const GLASS_CONTROL_BASE =
  'bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/60 dark:border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_1px_2px_rgba(0,0,0,0.2)]'
const GLASS_INPUT_STATE =
  'group-data-[hover=true]:bg-white/60 dark:group-data-[hover=true]:bg-white/10 group-data-[focus=true]:bg-white dark:group-data-[focus=true]:bg-default-100/60 group-data-[focus=true]:border-primary/50 group-data-[focus=true]:shadow-[0_0_0_1px_hsl(var(--heroui-primary)),0_4px_12px_rgba(0,0,0,0.05)]'
const GLASS_SELECT_STATE =
  'data-[hover=true]:bg-white/75 dark:data-[hover=true]:bg-white/[0.1] data-[hover=true]:border-default-300/80 dark:data-[hover=true]:border-white/20 data-[open=true]:bg-white dark:data-[open=true]:bg-default-100/80 data-[open=true]:border-primary/70 data-[open=true]:ring-2 data-[open=true]:ring-primary/15 data-[focus=true]:border-primary/60'
const CARD_TRANSITION = 'transition-[background-color,border-color,box-shadow,opacity] duration-300'
const PRESSABLE_CARD_TRANSITION =
  'transition-[background-color,border-color,box-shadow,transform,opacity] duration-300 active:scale-[0.98]'

export const CARD_STYLES = {
  // Base styles shared by all cards (transitions, borders, overflow)
  ROUNDED: 'rounded-2xl',
  BASE: 'relative overflow-hidden border antialiased transition-[background-color,border-color,box-shadow,opacity] duration-300 ease-out',

  // Shared glass surfaces for subscription, override, and auxiliary management cards.
  MANAGEMENT_CARD:
    'relative overflow-hidden rounded-2xl border antialiased backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_6px_16px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_2px_8px_rgba(0,0,0,0.2)] dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_6px_16px_rgba(0,0,0,0.3)] transition-[background-color,border-color,box-shadow] duration-200 ease-out data-[pressed=true]:scale-100 motion-reduce:transition-none',
  MANAGEMENT_NEUTRAL:
    'bg-white/40 hover:bg-white/60 border-white/40 hover:border-white/60 dark:bg-black/20 dark:hover:bg-white/5 dark:border-white/10 dark:hover:border-white/20',
  MANAGEMENT_PRIMARY:
    'bg-primary/10 hover:bg-primary/15 border-primary/20 hover:border-primary/30 dark:bg-primary/15 dark:hover:bg-primary/20 dark:border-primary/30 dark:hover:border-primary/40',
  MANAGEMENT_ENABLED:
    'bg-primary/5 hover:bg-primary/10 border-primary/10 hover:border-primary/20 dark:bg-primary/10 dark:hover:bg-primary/15 dark:border-primary/20 dark:hover:border-primary/30',

  // Active state: Lightweight Glass Selection (Brand-tinted) with glow and edge lighting
  ACTIVE: `bg-primary/10 dark:bg-primary/15 hover:bg-primary/15 dark:hover:bg-primary/20 backdrop-blur-md border-primary/20 dark:border-primary/30 hover:border-primary/30 dark:hover:border-primary/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_4px_16px_rgba(0,112,243,0.1)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_4px_16px_rgba(0,112,243,0.15)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_6px_20px_rgba(0,112,243,0.15)] dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_6px_20px_rgba(0,112,243,0.2)] ${PRESSABLE_CARD_TRANSITION}`,

  // Secondary active state: enabled in merged runtime but not the primary profile
  ACTIVE_SECONDARY: `bg-primary/5 dark:bg-primary/10 hover:bg-primary/10 dark:hover:bg-primary/15 backdrop-blur-md border-primary/10 hover:border-primary/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] hover:shadow-md ${PRESSABLE_CARD_TRANSITION}`,

  // Inactive state: iOS Liquid Glass with edge highlight and color/shadow feedback
  INACTIVE: `bg-white/30 dark:bg-black/20 hover:bg-white/50 dark:hover:bg-white/5 backdrop-blur-md border-white/30 dark:border-white/10 hover:border-white/50 dark:hover:border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_1px_2px_rgba(0,0,0,0.2)] hover:shadow-lg dark:hover:shadow-black/60 ${CARD_TRANSITION}`,

  // Shared glass control surface for inputs, selects, tabs, and capsules
  GLASS_CONTROL: GLASS_CONTROL_BASE,

  // Scope pill-shaped inputs to shared toolbars.
  GLASS_TOOLBAR: 'glass-toolbar',
  GLASS_TOOLBAR_BUTTON: 'rounded-full',

  // Input style: Matches the glass toolbar aesthetic
  GLASS_INPUT: {
    inputWrapper: `${GLASS_CONTROL_BASE} ${GLASS_INPUT_STATE} rounded-2xl !h-8 !min-h-8 transition-colors duration-300`,
    input: 'text-sm text-foreground',
    innerWrapper: 'bg-transparent'
  },

  // Form input & select styles: Unified rounded-full controls for modal/settings forms
  FORM_INPUT: {
    inputWrapper: `${GLASS_CONTROL_BASE} ${GLASS_INPUT_STATE} !bg-white/60 dark:!bg-white/5 !rounded-full !h-9 !min-h-9 transition-colors duration-300`,
    input: 'text-sm text-foreground',
    innerWrapper: 'bg-transparent'
  },

  FORM_SELECT: {
    trigger: `${GLASS_CONTROL_BASE} ${GLASS_SELECT_STATE} !bg-white/65 dark:!bg-white/[0.06] !rounded-full !h-9 !min-h-9 transition-all duration-200`,
    value: 'text-sm font-medium text-foreground/55 group-data-[has-value=true]:text-foreground',
    selectorIcon: 'text-foreground/60',
    listbox: 'p-1',
    popoverContent: GLASS_POPOVER_CONTENT
  },

  // Tabs style: Matches GLASS_CONTROL_BASE so switching capsules share the same surface as inputs
  GLASS_TABS: {
    tabList: `${GLASS_CONTROL_BASE} p-0 overflow-visible rounded-full`,
    cursor: 'w-full bg-background dark:bg-default-100 shadow-md rounded-full',
    tabContent:
      'font-medium text-foreground/75 group-data-[selected=true]:text-primary transition-colors',
    tab: 'h-8 px-3'
  },

  COMPACT_TABS: {
    tabList: `${GLASS_CONTROL_BASE} p-0 overflow-visible rounded-full`,
    cursor: 'w-full bg-background dark:bg-default-100 shadow-md rounded-full',
    tabContent:
      'font-medium text-foreground/75 group-data-[selected=true]:text-primary transition-colors',
    tab: 'h-7 px-3'
  },

  // Small item cards (like tools connectivity check)
  GLASS_ITEM_CARD:
    'bg-default-100/50 dark:bg-default-100/10 border border-default-200/50 dark:border-white/5 shadow-sm hover:shadow transition-[transform,background-color,border-color,box-shadow,opacity] duration-150',

  // Unified style for list items (connections, logs) without spatial translation
  LIST_CARD: `bg-default-100/60 dark:bg-default-50/30 border border-default-200/60 dark:border-white/10 hover:bg-default-200/70 dark:hover:bg-default-100/50 hover:border-default-300/80 dark:hover:border-white/20 hover:shadow-md dark:hover:shadow-black/40 ${CARD_TRANSITION}`,

  // Lighter style for large proxy group container cards
  PROXY_GROUP_CARD: `bg-default-50/50 dark:bg-default-50/20 border-white/20 dark:border-white/5 shadow-sm hover:bg-default-200/60 dark:hover:bg-white/10 hover:border-default-300/80 dark:hover:border-white/20 hover:shadow-md dark:hover:shadow-black/40 ${CARD_TRANSITION}`,

  // Style for proxy nodes and proxy group cards (unified hover & selected feedback)
  PROXY_ITEM_CARD:
    'bg-default-100/45 dark:bg-default-50/20 border-default-200/55 dark:border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_1px_2px_rgba(0,0,0,0.2)] hover:-translate-y-px data-[hover=true]:-translate-y-px hover:bg-primary/[0.04] data-[hover=true]:bg-primary/[0.04] dark:hover:bg-primary/[0.08] dark:data-[hover=true]:bg-primary/[0.08] hover:border-primary/25 data-[hover=true]:border-primary/25 dark:hover:border-primary/35 dark:data-[hover=true]:border-primary/35 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_6px_16px_rgba(0,111,238,0.08)] data-[hover=true]:shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_6px_16px_rgba(0,111,238,0.08)] dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_6px_18px_rgba(0,0,0,0.45)] dark:data-[hover=true]:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_6px_18px_rgba(0,0,0,0.45)] transition-[background-color,border-color,box-shadow,transform,opacity] duration-150 ease-out active:scale-[0.98] data-[pressed=true]:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none',

  PROXY_ITEM_SELECTED:
    'bg-primary/10 dark:bg-primary/15 border-primary/30 dark:border-primary/40 hover:bg-primary/[0.13] data-[hover=true]:bg-primary/[0.13] hover:border-primary/40 data-[hover=true]:border-primary/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_2px_12px_rgba(0,111,238,0.14)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_12px_rgba(0,111,238,0.22)] backdrop-blur-md z-10 transition-[background-color,border-color,box-shadow,transform,opacity] duration-150 ease-out active:scale-[0.98] data-[pressed=true]:scale-[0.98] motion-reduce:transition-none',

  // Sidebar hero cards (ProxyCard, ConnCard) with pure Liquid Glass hover
  SIDEBAR_HERO_CARD:
    'relative overflow-hidden border antialiased bg-white/35 dark:bg-black/20 backdrop-blur-md border-white/40 dark:border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_1px_3px_rgba(0,0,0,0.2)] hover:-translate-y-px data-[hover=true]:-translate-y-px hover:bg-white/62 data-[hover=true]:bg-white/62 dark:hover:bg-white/[0.08] dark:data-[hover=true]:bg-white/[0.08] hover:border-white/80 data-[hover=true]:border-white/80 dark:hover:border-white/25 dark:data-[hover=true]:border-white/25 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_6px_18px_rgba(0,0,0,0.07)] data-[hover=true]:shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_6px_18px_rgba(0,0,0,0.07)] dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_6px_20px_rgba(0,0,0,0.42)] dark:data-[hover=true]:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_6px_20px_rgba(0,0,0,0.42)] transition-[background-color,border-color,box-shadow,transform,opacity] duration-150 ease-out active:scale-[0.98] data-[pressed=true]:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none',

  SIDEBAR_HERO_ACTIVE:
    'relative overflow-hidden border antialiased bg-primary/10 dark:bg-primary/15 border-primary/25 dark:border-primary/35 hover:bg-primary/[0.14] data-[hover=true]:bg-primary/[0.14] hover:border-primary/35 data-[hover=true]:border-primary/35 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_16px_rgba(0,112,243,0.12)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_16px_rgba(0,112,243,0.2)] transition-[background-color,border-color,box-shadow,transform,opacity] duration-150 ease-out active:scale-[0.98] data-[pressed=true]:scale-[0.98] motion-reduce:transition-none',

  // Sidebar row hover state: neutral frosted glass highlight without colored border framing
  SIDEBAR_ITEM:
    'border border-transparent hover:bg-white/55 dark:hover:bg-white/[0.08] hover:border-white/60 dark:hover:border-white/15 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-[background-color,border-color,box-shadow,transform,opacity] duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none',

  // Sidebar active state: Match mode switcher active pill
  SIDEBAR_ACTIVE:
    'border border-primary/20 dark:border-primary/30 bg-primary/15 dark:bg-primary/20 hover:bg-primary/[0.18] dark:hover:bg-primary/[0.24] backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-[background-color,border-color,transform,opacity] duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none',

  // Glass card style (used for tooltips etc)
  GLASS_CARD:
    'bg-background/78 dark:bg-default-100/78 border border-default-200/45 dark:border-white/8 shadow-lg backdrop-blur-[8px]',

  // Management card typography
  MANAGEMENT_TITLE:
    'text-ellipsis whitespace-nowrap overflow-hidden text-md font-bold leading-[32px] text-foreground',
  MANAGEMENT_ACTION_BUTTON: 'h-[28px] w-[28px] min-w-[28px] rounded-full p-0',
  MANAGEMENT_ACTION_ICON: 'text-[21px] text-foreground',
  MANAGEMENT_STATUS_BUTTON: 'h-6 min-w-0 px-3 text-[12px]',
  MANAGEMENT_STATUS_INACTIVE:
    'border-default-200 bg-default-100/70 text-foreground/75 shadow-none hover:border-default-300 hover:bg-default-200/70 hover:text-foreground dark:border-white/10 dark:bg-white/[0.06] dark:hover:bg-white/[0.09]',
  MANAGEMENT_META_TEXT: 'text-sm text-foreground',
  MANAGEMENT_META_BUTTON: 'h-[20px] p-1 m-0 text-xs text-foreground',
  MANAGEMENT_FOOTER_ROW: 'flex items-center justify-between text-sm text-foreground',

  GLASS_SELECT: {
    trigger: `${GLASS_CONTROL_BASE} ${GLASS_SELECT_STATE} bg-white/60 dark:bg-white/[0.06] rounded-full h-8 min-h-8 transition-all duration-200`,
    value: 'text-sm font-medium text-foreground/55 group-data-[has-value=true]:text-foreground',
    selectorIcon: 'text-foreground/60',
    listbox: 'p-1',
    popoverContent: GLASS_POPOVER_CONTENT
  },

  // Dropdown style: Matches GLASS_SELECT popover
  GLASS_DROPDOWN: {
    content: GLASS_POPOVER_CONTENT
  },

  // Data Grid Style
  GLASS_TABLE_HEADER:
    'sticky top-0 z-10 bg-default-100/78 dark:bg-default-50/78 backdrop-blur-[12px] border-b border-default-200/50 dark:border-white/10 text-xs font-semibold text-foreground/75 flex items-center w-full shadow-sm',
  GLASS_TABLE_ROW:
    'group relative flex items-center border-b border-default-200/50 dark:border-white/5 hover:bg-default-100/50 dark:hover:bg-white/5 transition-[background-color,border-color,box-shadow,opacity] duration-300 ease-out cursor-pointer data-[selected=true]:bg-gradient-to-r data-[selected=true]:from-primary/15 data-[selected=true]:to-transparent data-[selected=true]:border-primary/20 data-[selected=true]:shadow-[inset_3px_0_0_0_hsl(var(--heroui-primary))]',
  GLASS_TABLE_CELL: 'px-3 py-2.5 text-sm truncate flex items-center'
}
