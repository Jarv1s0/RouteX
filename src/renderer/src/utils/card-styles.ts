export const CARD_STYLES = {
  // Base styles shared by all cards (transitions, borders, overflow)
  ROUNDED: 'rounded-2xl',
  BASE: 'relative overflow-hidden border antialiased transition-[transform,background-color,border-color,box-shadow,opacity] duration-150 ease-out',

  // Active state: Lightweight Glass Selection (Brand-tinted)
  ACTIVE:
    'bg-primary/10 dark:bg-primary/15 backdrop-blur-md border-primary/20 dark:border-primary/30 shadow-sm shadow-primary/10',

  // Secondary active state: enabled in merged runtime but not the primary profile
  ACTIVE_SECONDARY:
    'bg-primary/5 dark:bg-primary/10 backdrop-blur-md border-primary/10 shadow-sm',

  // Inactive state: iOS Liquid Glass (Subtle and restrained)
  INACTIVE:
    'bg-white/30 dark:bg-black/20 hover:bg-white/50 dark:hover:bg-white/5 backdrop-blur-lg border-white/30 dark:border-white/10 hover:border-white/50 dark:hover:border-white/20 shadow-sm hover:shadow-md transition-all',

  // Toolbar style: Same as INACTIVE but without scale and tuned for toolbar
  GLASS_TOOLBAR:
    'flex items-center transition-[background-color,border-color,box-shadow,opacity] duration-150 bg-gradient-to-b from-white/8 to-transparent dark:from-white/2 dark:to-transparent hover:from-white/16 hover:to-white/5 dark:hover:from-white/8 dark:hover:to-white/2 border border-white/14 dark:border-white/6 hover:border-white/40 dark:hover:border-white/20 backdrop-blur-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_2px_10px_0_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_8px_20px_0_rgba(0,0,0,0.1)] dark:hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15),0_4px_16px_0_rgba(0,0,0,0.3)] overflow-visible',

  // Input style: Matches the glass toolbar aesthetic
  GLASS_INPUT: {
    inputWrapper:
      'bg-default-200/50 dark:bg-default-100/50 shadow-none border border-default-200/50 dark:border-transparent group-data-[focus=true]:bg-default-200/80 group-data-[hover=true]:bg-default-200/80 rounded-2xl h-8 transition-[background-color,border-color,box-shadow]',
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

  // Sidebar row hover state: clearer than the default gray strip
  SIDEBAR_ITEM: 'hover:bg-primary/5 dark:hover:bg-primary/10 hover:shadow-sm transition-all duration-300',

  // Sidebar active state: Match mode switcher active pill
  SIDEBAR_ACTIVE: 'bg-primary/20 dark:bg-primary/20 backdrop-blur-md border-transparent shadow-sm shadow-primary/10 transition-all duration-300',

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

  // Select style: Matches GLASS_INPUT
  GLASS_SELECT: {
    trigger:
      'bg-default-200/50 dark:bg-default-100/50 shadow-none border border-default-200/50 dark:border-transparent data-[hover=true]:bg-default-200/80 rounded-2xl h-8 min-h-8 transition-[background-color,border-color,box-shadow]',
    value: 'text-sm',
    popoverContent:
      'backdrop-blur-[10px] bg-background/78 dark:bg-default-100/50 rounded-2xl border border-default-200/45 dark:border-white/8 shadow-lg'
  },

  // Data Grid Style
  GLASS_TABLE_HEADER:
    'sticky top-0 z-10 bg-default-100/78 dark:bg-default-50/78 backdrop-blur-[10px] border-b border-default-200/45 dark:border-white/8 text-xs font-semibold text-default-500 flex items-center w-full',
  GLASS_TABLE_ROW:
    'group relative flex items-center border-b border-default-200/50 dark:border-white/5 hover:bg-default-100/50 dark:hover:bg-white/5 transition-colors cursor-pointer data-[selected=true]:bg-primary/10 data-[selected=true]:border-primary/20',
  GLASS_TABLE_CELL: 'px-3 py-2.5 text-sm truncate flex items-center'
}
