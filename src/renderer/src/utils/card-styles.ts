export const CARD_STYLES = {
  // Base styles shared by all cards (transitions, borders, overflow)
  BASE: "relative overflow-hidden transition-all duration-500 border",
  
  // Active state: Dynamic Theme Gradient (Primary -> Primary-600)
  ACTIVE: "bg-gradient-to-br from-primary/90 to-primary-600/90 border-primary/50 shadow-lg shadow-primary/20",
  
  // Inactive state: iOS 26 Liquid Glass
  // Features: High blur (3xl), Specular Highlight (from-white/20), Inset Shadow (Glass thickness), Saturation post-process
  INACTIVE: "bg-gradient-to-b from-white/20 to-white/5 dark:from-white/10 dark:to-transparent border-white/20 hover:border-white/40 backdrop-blur-3xl backdrop-saturate-150 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_8px_32px_0_rgba(0,0,0,0.1)] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_15px_40px_0_rgba(0,0,0,0.2)] hover:scale-[1.02]"
}
