import { Button, Card, CardBody } from '@heroui/react'
import { MdOutlineSpeed } from 'react-icons/md'
import { getImageDataURL } from '@renderer/utils/ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useEffect, memo } from 'react'
import { addFlag } from '@renderer/utils/flags'


interface Props {
  group: ControllerMixedGroup
  groupIndex: number
  isOpen: boolean
  toggleOpen: (index: number) => void
  searchValue: string
  updateSearchValue: (index: number, value: string) => void
  delaying: boolean
  onGroupDelay: (index: number) => Promise<void>
  getCurrentDelay: (group: ControllerMixedGroup) => number
  mutate: () => void
  getDelayColor: (proxy: ControllerProxiesDetail | ControllerGroupDetail) => string
}

const ProxyGroupCardComponent: React.FC<Props> = ({
  group,
  groupIndex,
  isOpen,
  toggleOpen,
  delaying,
  onGroupDelay,
  getCurrentDelay,
  mutate
}) => {
  const { appConfig } = useAppConfig()
  const currentDelay = getCurrentDelay(group)
  const { delayThresholds = { good: 200, fair: 500 } } = appConfig || {}

  const delayColor =
    currentDelay === -1
      ? 'text-default-400'
      : currentDelay === 0
        ? 'text-default-400' // 0 treated as unknown (gray)
        : currentDelay < delayThresholds.good
          ? 'text-success'
          : currentDelay < delayThresholds.fair
            ? 'text-warning'
            : 'text-danger'

  // Icon handling
  useEffect(() => {
    if (
        group.icon &&
        group.icon.startsWith('http') &&
        !localStorage.getItem(group.icon)
      ) {
        getImageDataURL(group.icon).then((dataURL) => {
          localStorage.setItem(group.icon, dataURL)
          mutate()
        })
      }
  }, [group.icon, mutate])

  // Active Glow Style
  // Active Glow Style
  const activeStyle = isOpen 
    ? "bg-gradient-to-br from-default-100/90 to-default-50/90 backdrop-blur-2xl border-primary/30 shadow-[inset_0_-4px_10px_rgba(0,0,0,0.03),0_0_24px_rgba(var(--heroui-primary),0.12)] scale-[1.01] ring-1 ring-primary/20 relative" 
    : "bg-default-50/40 dark:bg-default-50/20 backdrop-blur-md border-white/10 dark:border-white/5 shadow-sm hover:scale-[1.002] hover:bg-default-100/60 hover:shadow-md hover:border-default-200/40"

  return (
    <div className="w-full pt-2 px-2">
      <Card
        as="div"
        isPressable
        fullWidth
        onPress={() => toggleOpen(groupIndex)}
        className={`transition-all duration-200 border group ${activeStyle}`}
      >
        <CardBody className="w-full p-4">
          {/* Header Row */}
          <div className="flex justify-between items-center">
            {/* Left: Info */}
            <div className="flex items-center gap-3">
              {/* Icon Container */}
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ${isOpen ? 'bg-primary/10 text-primary' : 'bg-default-100 text-default-500'}`}>
                {group.icon ? (
                  <img
                    className="w-5 h-5 object-contain"
                    src={
                      group.icon.startsWith('<svg')
                        ? `data:image/svg+xml;utf8,${group.icon}`
                        : localStorage.getItem(group.icon) || group.icon
                    }
                    alt=""
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-current" />
                )}
              </div>

              <div className="flex flex-col items-start gap-0.5">
                <div className="flex items-center gap-2">
                  <span className={`font-bold text-base tracking-tight transition-colors ${isOpen ? 'text-foreground' : 'text-foreground/80'}`}>
                    {group.name}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-default-100 text-default-500 uppercase font-bold tracking-wider opacity-60">
                    {group.type}
                  </span>
                </div>
                
                {/* Stats Subtitle */}
                {/* Stats Capsule */}
                {/* Stats & Dots Capsules */}
                {/* Stats & Dots Capsules */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center px-3 py-1 rounded-md bg-default-100/80 border border-default-200/50 hover:bg-default-200/50 transition-colors">
                    <span className="text-[10px] font-bold text-default-400 uppercase tracking-wider mr-2">Live</span>
                    <span className="text-xs font-mono font-medium text-foreground/80">
                      {(group.all || []).filter(p => p.history?.some(h => h.delay > 0)).length}
                      <span className="opacity-40 mx-0.5">/</span>
                      {(group.all || []).length}
                    </span>
                    <div className={`ml-2 w-1.5 h-1.5 rounded-full transition-colors duration-500 ${
                      currentDelay === -1 ? 'bg-default-300' :
                      currentDelay === 0 ? 'bg-default-400' :
                      currentDelay < delayThresholds.good ? 'bg-success shadow-[0_0_8px_rgba(23,201,100,0.4)] animate-pulse' :
                      currentDelay < delayThresholds.fair ? 'bg-warning shadow-[0_0_8px_rgba(245,165,36,0.4)] animate-pulse' :
                      'bg-danger shadow-[0_0_8px_rgba(243,18,96,0.4)] animate-pulse'
                    }`} />
                  </div>


                </div>
              </div>
            </div>

            {/* Right: Controls & Delay */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-default-100/50 dark:bg-default-50/50 border border-default-200/50 rounded-xl px-1.5 py-1.5 backdrop-blur-md transition-colors hover:bg-default-200/50">
                {/* Node Name */}
                <div className="flex items-center max-w-[140px] px-2 border-r border-default-200/50">
                  <span className={`text-xs font-semibold truncate flag-emoji tracking-wide flex items-center gap-1.5 transition-colors ${currentDelay === 0 ? 'text-default-400' : 'text-foreground/80'}`} title={group.now}>
                    <div className={`w-1.5 h-1.5 rounded-full ${delayColor.replace('text-', 'bg-')} ${currentDelay !== 0 && currentDelay !== -1 ? 'shadow-sm' : ''}`} />
                    {addFlag(group.now)}
                  </span>
                </div>

                {/* Delay Value */}
                <div className="flex items-center justify-center min-w-[54px] px-2">
                  <span className={`text-sm font-bold font-mono ${delayColor}`}>
                    {currentDelay === -1 || currentDelay === 0 ? '--' : `${currentDelay}`}
                  </span>
                  {(currentDelay !== -1 && currentDelay !== 0) && (
                     <span className="text-[10px] font-medium text-foreground-400 ml-[1px]">ms</span>
                  )}
                </div>
              </div>

              {isOpen && (
                <div className="flex items-center animate-appearance-in" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="flat"
                    color="primary"
                    size="sm"
                    isIconOnly
                    radius="lg"
                    className="bg-primary/10 hover:bg-primary/20 text-primary shadow-sm"
                    onPress={() => onGroupDelay(groupIndex)}
                    isDisabled={delaying}
                  >
                    {delaying ? (
                      <div className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                    ) : (
                      <MdOutlineSpeed className="text-lg" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>




        </CardBody>
        {isOpen && (
           <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        )}
      </Card>
    </div>
  )
}

export const ProxyGroupCard = memo(ProxyGroupCardComponent, (prev, next) => {
    // Only update if relevant props changed
    return (
        prev.isOpen === next.isOpen &&
        prev.delaying === next.delaying &&
        prev.searchValue === next.searchValue &&
        prev.group.name === next.group.name &&
        prev.group.now === next.group.now &&
        // Check live count efficiently? Or just accept fetch update. 
        // Comparing length is cheap.
        (prev.group.all?.length === next.group.all?.length) &&
        // If it's closed, we don't care about internal updates that much? 
        // But the "Live" count and "Delay" indicator needs updates.
        // So we might as well rely on shallow compare of group if mutate changes ref.
        // But mutate ALWAYS chances ref.
        // So we must compare data.
        // Let's compare the last history item of the "now" proxy for the delay dot?
        // Actually `getCurrentDelay` calculates it.
        prev.getCurrentDelay(prev.group) === next.getCurrentDelay(next.group)
        // And live count?
        // That is expensive to calculate in comparator.
        // Let's just return false if we are not sure. 
        // But at least if isOpen/delaying/searchValue/name/now/delay is same, we might skip.
    )
})
