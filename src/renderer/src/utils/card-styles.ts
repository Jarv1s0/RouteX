export const CARD_STYLES = {
  // Base styles shared by all cards (transitions, borders, overflow)
  ROUNDED: "rounded-2xl",
  BASE: "relative overflow-hidden transition-all duration-300 border antialiased",
  
  // Active state: Dynamic Theme Gradient (Primary -> Primary-600)
  ACTIVE: "bg-primary/85 dark:bg-primary/90 backdrop-blur-md border border-white/20 shadow-[0_4px_20px_rgba(var(--heroui-primary),0.4)] hover:scale-[1.02]",
  
  // Inactive state: iOS 26 Liquid Glass
  // Features: High blur (3xl), Specular Highlight (from-white/20), Inset Shadow (Glass thickness), Saturation post-process
  INACTIVE: "bg-gradient-to-b from-white/20 to-white/5 dark:from-white/5 dark:to-transparent border-white/20 dark:border-white/10 hover:border-white/40 dark:hover:border-white/20 backdrop-blur-3xl backdrop-saturate-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_8px_32px_0_rgba(0,0,0,0.1)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_15px_40px_0_rgba(0,0,0,0.2)] dark:hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] hover:scale-[1.02]",
  
  // Toolbar style: Same as INACTIVE but without scale and tuned for toolbar
  GLASS_TOOLBAR: "flex items-center transition-all duration-300 bg-gradient-to-b from-white/20 to-white/5 dark:from-white/5 dark:to-transparent border border-white/20 dark:border-white/10 hover:border-white/40 dark:hover:border-white/20 backdrop-blur-3xl backdrop-saturate-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_8px_32px_0_rgba(0,0,0,0.1)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_15px_40px_0_rgba(0,0,0,0.2)] dark:hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] overflow-visible",
  
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
