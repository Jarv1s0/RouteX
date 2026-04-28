export const CARD_STYLES = {
  // Base styles shared by all cards (transitions, borders, overflow)
  ROUNDED: "rounded-2xl",
  BASE: "relative overflow-hidden border antialiased transition-[transform,background-color,border-color,box-shadow,opacity] duration-150 ease-out",
  
  // Active state: Lightweight Glass Selection (Brand-tinted)
  ACTIVE: "bg-primary/20 dark:bg-primary/22 backdrop-blur-sm shadow-sm shadow-primary/5 border-primary/16",

  // Secondary active state: enabled in merged runtime but not the primary profile
  ACTIVE_SECONDARY:
    "bg-primary/10 dark:bg-primary/12 backdrop-blur-sm border-primary/16 shadow-sm shadow-primary/5",
  
  // Inactive state: iOS 26 Liquid Glass
  INACTIVE: "bg-gradient-to-b from-white/12 to-white/4 dark:from-white/3 dark:to-transparent border-white/14 dark:border-white/6 hover:border-white/22 dark:hover:border-white/10 backdrop-blur-[6px] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_2px_10px_0_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.26),0_4px_12px_0_rgba(0,0,0,0.08)] dark:hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]",
  
  // Toolbar style: Same as INACTIVE but without scale and tuned for toolbar
  GLASS_TOOLBAR: "flex items-center transition-[background-color,border-color,box-shadow,opacity] duration-150 bg-gradient-to-b from-white/12 to-white/4 dark:from-white/3 dark:to-transparent border border-white/14 dark:border-white/6 hover:border-white/22 dark:hover:border-white/10 backdrop-blur-[6px] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_2px_10px_0_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.26),0_4px_12px_0_rgba(0,0,0,0.08)] dark:hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] overflow-visible",
  
  // Input style: Matches the glass toolbar aesthetic
  GLASS_INPUT: {
    inputWrapper: "bg-default-200/50 dark:bg-default-100/50 shadow-none border border-default-200/50 dark:border-transparent group-data-[focus=true]:bg-default-200/80 group-data-[hover=true]:bg-default-200/80 rounded-2xl h-8 transition-[background-color,border-color,box-shadow]",
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
  GLASS_ITEM_CARD: "bg-default-100/50 dark:bg-default-100/10 border border-default-200/50 dark:border-white/5 shadow-sm hover:shadow transition-[transform,background-color,border-color,box-shadow,opacity] duration-150",

  // Sidebar row hover state: clearer than the default gray strip
  SIDEBAR_ITEM: "hover:bg-primary/10 dark:hover:bg-primary/20",
  
  // Sidebar active state: Match mode switcher active pill
  SIDEBAR_ACTIVE:
    "bg-primary/30 dark:bg-primary/30 backdrop-blur-md border-transparent shadow-sm",

  // Glass card style (used for tooltips etc)
  GLASS_CARD: "bg-background/78 dark:bg-default-100/78 border border-default-200/45 dark:border-white/8 shadow-lg backdrop-blur-[8px]",

  // Select style: Matches GLASS_INPUT
  GLASS_SELECT: {
    trigger: "bg-default-200/50 dark:bg-default-100/50 shadow-none border border-default-200/50 dark:border-transparent data-[hover=true]:bg-default-200/80 rounded-2xl h-8 min-h-8 transition-[background-color,border-color,box-shadow]",
    value: "text-sm",
    popoverContent: "backdrop-blur-[10px] bg-background/78 dark:bg-default-100/50 rounded-2xl border border-default-200/45 dark:border-white/8 shadow-lg"
  },

  // Data Grid Style
  GLASS_TABLE_HEADER: "sticky top-0 z-10 bg-default-100/78 dark:bg-default-50/78 backdrop-blur-[10px] border-b border-default-200/45 dark:border-white/8 text-xs font-semibold text-default-500 flex items-center w-full",
  GLASS_TABLE_ROW: "group relative flex items-center border-b border-default-200/50 dark:border-white/5 hover:bg-default-100/50 dark:hover:bg-white/5 transition-colors cursor-pointer data-[selected=true]:bg-primary/10 data-[selected=true]:border-primary/20",
  GLASS_TABLE_CELL: "px-3 py-2.5 text-sm truncate flex items-center"
}
