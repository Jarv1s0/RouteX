export const CARD_STYLES = {
  // Base styles shared by all cards (transitions, borders, overflow)
  ROUNDED: "rounded-2xl",
  BASE: "relative overflow-hidden transition-[background-color,border-color,box-shadow,opacity] duration-200 border antialiased",
  
  // Active state: Lightweight Glass Selection (Brand-tinted)
  ACTIVE: "bg-primary/30 dark:bg-primary/30 backdrop-blur-md shadow-md shadow-primary/5 border-transparent",

  // Secondary active state: enabled in merged runtime but not the primary profile
  ACTIVE_SECONDARY:
    "bg-primary/15 dark:bg-primary/15 backdrop-blur-md border-primary/20 shadow-sm shadow-primary/5",
  
  // Inactive state: iOS 26 Liquid Glass
  INACTIVE: "bg-gradient-to-b from-white/20 to-white/5 dark:from-white/5 dark:to-transparent border-white/20 dark:border-white/10 hover:border-white/40 dark:hover:border-white/20 backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_8px_32px_0_rgba(0,0,0,0.08)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_12px_36px_0_rgba(0,0,0,0.15)] dark:hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]",
  
  // Toolbar style: Same as INACTIVE but without scale and tuned for toolbar
  GLASS_TOOLBAR: "flex items-center transition-[background-color,border-color,box-shadow,opacity] duration-200 bg-gradient-to-b from-white/20 to-white/5 dark:from-white/5 dark:to-transparent border border-white/20 dark:border-white/10 hover:border-white/40 dark:hover:border-white/20 backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_8px_32px_0_rgba(0,0,0,0.08)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_12px_36px_0_rgba(0,0,0,0.15)] dark:hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] overflow-visible",
  
  // Input style: Matches the glass toolbar aesthetic
  GLASS_INPUT: {
    inputWrapper: "bg-default-200/50 dark:bg-default-100/50 shadow-none border border-default-200/50 dark:border-transparent group-data-[focus=true]:bg-default-200/80 group-data-[hover=true]:bg-default-200/80 rounded-2xl h-8 transition-all",
    input: "text-sm",
    innerWrapper: "bg-transparent",
  },
  
  // Tabs style: Clean aesthetic without background container, highlighting the cursor
  GLASS_TABS: {
    tabList: "bg-default-100/50 dark:bg-default-100/20 border border-default-200/50 dark:border-default-100/10 shadow-none p-0 overflow-visible rounded-2xl",
    cursor: "w-full bg-background dark:bg-default-100 shadow-md rounded-2xl",
    tabContent: "font-medium text-default-500 group-data-[selected=true]:text-primary transition-colors",
    tab: "h-8 px-3"
  },

  // Small item cards (like tools connectivity check)
  GLASS_ITEM_CARD: "bg-default-100/50 dark:bg-default-100/10 border border-default-200/50 dark:border-white/5 shadow-sm hover:shadow-md transition-all duration-200",

  // Sidebar row hover state: clearer than the default gray strip
  SIDEBAR_ITEM: "hover:bg-primary/10 dark:hover:bg-primary/20",
  
  // Sidebar active state: Match mode switcher active pill
  SIDEBAR_ACTIVE:
    "bg-primary/30 dark:bg-primary/30 backdrop-blur-md border-transparent shadow-sm",

  // Glass card style (used for tooltips etc)
  GLASS_CARD: "bg-background/80 dark:bg-default-100/80 border border-default-200/50 dark:border-white/10 shadow-xl backdrop-blur-md",

  // Select style: Matches GLASS_INPUT
  GLASS_SELECT: {
    trigger: "bg-default-200/50 dark:bg-default-100/50 shadow-none border border-default-200/50 dark:border-transparent data-[hover=true]:bg-default-200/80 rounded-2xl h-8 min-h-8 transition-all",
    value: "text-sm",
    popoverContent: "backdrop-blur-xl bg-background/80 dark:bg-default-100/50 rounded-2xl border border-default-200/50 dark:border-white/10 shadow-xl"
  },

  // Data Grid Style
  GLASS_TABLE_HEADER: "sticky top-0 z-10 bg-default-100/80 dark:bg-default-50/80 backdrop-blur-xl border-b border-default-200/50 dark:border-white/10 text-xs font-semibold text-default-500 flex items-center w-full",
  GLASS_TABLE_ROW: "group relative flex items-center border-b border-default-200/50 dark:border-white/5 hover:bg-default-100/50 dark:hover:bg-white/5 transition-colors cursor-pointer data-[selected=true]:bg-primary/10 data-[selected=true]:border-primary/20",
  GLASS_TABLE_CELL: "px-3 py-2.5 text-sm truncate flex items-center"
}
