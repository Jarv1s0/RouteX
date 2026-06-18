const GLASS_POPOVER_CONTENT =
  'backdrop-blur-[12px] bg-background/80 dark:bg-default-100/60 rounded-2xl border border-default-200/50 dark:border-white/10 shadow-xl animate-pop-in max-h-[300px] overflow-y-auto'
const GLASS_CONTROL_BASE =
  'bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/60 dark:border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_1px_2px_rgba(0,0,0,0.2)]'
const GLASS_INPUT_STATE =
  'group-data-[hover=true]:bg-white/60 dark:group-data-[hover=true]:bg-white/10 group-data-[focus=true]:bg-white dark:group-data-[focus=true]:bg-default-100/60 group-data-[focus=true]:border-primary/50 group-data-[focus=true]:shadow-[0_0_0_1px_hsl(var(--heroui-primary)),0_4px_12px_rgba(0,0,0,0.05)]'
const GLASS_SELECT_STATE =
  'data-[hover=true]:bg-white/60 dark:data-[hover=true]:bg-white/10 data-[open=true]:bg-white dark:data-[open=true]:bg-default-100/60 data-[focus=true]:border-primary/50 data-[open=true]:shadow-[0_0_0_1px_hsl(var(--heroui-primary)),0_4px_12px_rgba(0,0,0,0.05)]'
const CARD_TRANSITION = 'transition-[background-color,border-color,box-shadow,opacity] duration-300'
const PRESSABLE_CARD_TRANSITION =
  'transition-[background-color,border-color,box-shadow,transform,opacity] duration-300 active:scale-[0.98]'

export const CARD_STYLES = {
  // Base styles shared by all cards (transitions, borders, overflow)
  ROUNDED: 'rounded-2xl',
  BASE: 'relative overflow-hidden border antialiased transition-[background-color,border-color,box-shadow,opacity] duration-300 ease-out',

  // Active state: Lightweight Glass Selection (Brand-tinted) with glow and edge lighting
  ACTIVE:
    `bg-primary/10 dark:bg-primary/15 hover:bg-primary/15 dark:hover:bg-primary/20 backdrop-blur-md border-primary/20 dark:border-primary/30 hover:border-primary/30 dark:hover:border-primary/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_4px_16px_rgba(0,112,243,0.1)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_4px_16px_rgba(0,112,243,0.15)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_6px_20px_rgba(0,112,243,0.15)] dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_6px_20px_rgba(0,112,243,0.2)] ${PRESSABLE_CARD_TRANSITION}`,

  // Secondary active state: enabled in merged runtime but not the primary profile
  ACTIVE_SECONDARY:
    `bg-primary/5 dark:bg-primary/10 hover:bg-primary/10 dark:hover:bg-primary/15 backdrop-blur-md border-primary/10 hover:border-primary/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] hover:shadow-md ${PRESSABLE_CARD_TRANSITION}`,

  // Inactive state: iOS Liquid Glass with edge highlight and color/shadow feedback
  INACTIVE:
    `bg-white/30 dark:bg-black/20 hover:bg-white/50 dark:hover:bg-white/5 backdrop-blur-md border-white/30 dark:border-white/10 hover:border-white/50 dark:hover:border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_1px_2px_rgba(0,0,0,0.2)] hover:shadow-lg dark:hover:shadow-black/60 ${CARD_TRANSITION}`,

  // Header switcher: subtle floating pill, safe color/shadow hover effect (no spatial translation)
  HEADER_SWITCHER:
    `bg-white/40 dark:bg-black/30 hover:bg-white/60 dark:hover:bg-white/5 backdrop-blur-md border-white/40 dark:border-white/10 hover:border-white/60 dark:hover:border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_2px_8px_rgba(0,0,0,0.2)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_6px_16px_rgba(0,0,0,0.08)] dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_6px_16px_rgba(0,0,0,0.3)] ${CARD_TRANSITION}`,

  // Toolbar style: Same as INACTIVE but without scale and tuned for toolbar
  GLASS_TOOLBAR:
    'flex items-center transition-[background-color,border-color,box-shadow,opacity] duration-150 bg-gradient-to-b from-white/8 to-transparent dark:from-white/2 dark:to-transparent hover:from-white/16 hover:to-white/5 dark:hover:from-white/8 dark:hover:to-white/2 border border-white/14 dark:border-white/6 hover:border-white/40 dark:hover:border-white/20 backdrop-blur-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_2px_10px_0_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_8px_20px_0_rgba(0,0,0,0.1)] dark:hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15),0_4px_16px_0_rgba(0,0,0,0.3)] overflow-visible',

  // Input style: Matches the glass toolbar aesthetic
  GLASS_INPUT: {
    inputWrapper: `${GLASS_CONTROL_BASE} ${GLASS_INPUT_STATE} rounded-2xl !h-8 !min-h-8 transition-colors duration-300`,
    input: 'text-sm',
    innerWrapper: 'bg-transparent'
  },

  // Tabs style: Clean aesthetic without background container, highlighting the cursor
  GLASS_TABS: {
    tabList:
      'bg-default-100/50 dark:bg-default-100/20 border border-default-200/50 dark:border-default-100/10 shadow-none p-0 overflow-visible rounded-2xl',
    cursor: 'w-full bg-background dark:bg-default-100 shadow-md rounded-2xl',
    tabContent:
      'font-medium text-default-500 group-data-[selected=true]:text-primary transition-colors',
    tab: 'h-8 px-3'
  },

  // Small item cards (like tools connectivity check)
  GLASS_ITEM_CARD:
    'bg-default-100/50 dark:bg-default-100/10 border border-default-200/50 dark:border-white/5 shadow-sm hover:shadow transition-[transform,background-color,border-color,box-shadow,opacity] duration-150',

  // Unified style for list items (connections, logs) without spatial translation
  LIST_CARD:
    `bg-default-100/60 dark:bg-default-50/30 border border-default-200/60 dark:border-white/10 hover:bg-default-200/70 dark:hover:bg-default-100/50 hover:border-default-300/80 dark:hover:border-white/20 hover:shadow-md dark:hover:shadow-black/40 ${CARD_TRANSITION}`,

  // Lighter style for large proxy group container cards
  PROXY_GROUP_CARD:
    `bg-default-50/50 dark:bg-default-50/20 border-white/20 dark:border-white/5 shadow-sm hover:bg-default-200/60 dark:hover:bg-white/10 hover:border-default-300/80 dark:hover:border-white/20 hover:shadow-md dark:hover:shadow-black/40 ${CARD_TRANSITION}`,

  // Style for proxy nodes inside the proxy group
  PROXY_ITEM_CARD:
    `bg-default-100/40 dark:bg-default-50/20 border-default-200/50 dark:border-white/5 hover:bg-default-200/60 dark:hover:bg-white/10 hover:border-default-300/80 dark:hover:border-white/20 hover:shadow-md dark:hover:shadow-black/40 ${PRESSABLE_CARD_TRANSITION}`,

  // Premium, highly translucent glass style specifically for rule cards
  RULE_CARD:
    `bg-white/50 dark:bg-black/20 backdrop-blur-md border border-white/60 dark:border-white/10 shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-none hover:bg-default-200/60 dark:hover:bg-white/10 hover:border-default-300/80 dark:hover:border-white/20 hover:shadow-md dark:hover:shadow-black/40 ${CARD_TRANSITION}`,

  // Sidebar row hover state: clearer than the default gray strip
  SIDEBAR_ITEM:
    `hover:bg-primary/5 dark:hover:bg-primary/10 hover:shadow-sm ${PRESSABLE_CARD_TRANSITION}`,

  // Sidebar active state: Match mode switcher active pill
  SIDEBAR_ACTIVE:
    `bg-primary/20 dark:bg-primary/20 backdrop-blur-md border-transparent shadow-sm shadow-primary/10 ${PRESSABLE_CARD_TRANSITION}`,

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
    'border-default-200 bg-default-100/70 text-default-500 shadow-none hover:border-default-300 hover:bg-default-200/70 dark:border-white/10 dark:bg-white/[0.06] dark:text-default-400 dark:hover:bg-white/[0.09]',
  MANAGEMENT_META_TEXT: 'text-sm text-foreground',
  MANAGEMENT_META_BUTTON: 'h-[20px] p-1 m-0 text-xs text-foreground',
  MANAGEMENT_FOOTER_ROW: 'flex items-center justify-between text-sm text-foreground',

  GLASS_SELECT: {
    trigger: `${GLASS_CONTROL_BASE} ${GLASS_SELECT_STATE} rounded-2xl h-8 min-h-8 transition-colors duration-300`,
    value: 'text-sm',
    popoverContent: GLASS_POPOVER_CONTENT
  },

  // Dropdown style: Matches GLASS_SELECT popover
  GLASS_DROPDOWN: {
    content: GLASS_POPOVER_CONTENT
  },

  // Data Grid Style
  GLASS_TABLE_HEADER:
    'sticky top-0 z-10 bg-default-100/78 dark:bg-default-50/78 backdrop-blur-[12px] border-b border-default-200/50 dark:border-white/10 text-xs font-semibold text-default-500 flex items-center w-full shadow-sm',
  GLASS_TABLE_ROW:
    'group relative flex items-center border-b border-default-200/50 dark:border-white/5 hover:bg-default-100/50 dark:hover:bg-white/5 transition-[background-color,border-color,box-shadow,opacity] duration-300 ease-out cursor-pointer data-[selected=true]:bg-gradient-to-r data-[selected=true]:from-primary/15 data-[selected=true]:to-transparent data-[selected=true]:border-primary/20 data-[selected=true]:shadow-[inset_3px_0_0_0_hsl(var(--heroui-primary))]',
  GLASS_TABLE_CELL: 'px-3 py-2.5 text-sm truncate flex items-center'
}
