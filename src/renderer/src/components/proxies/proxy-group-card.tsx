import { Button, Card, CardBody } from '@heroui/react'
import { MdOutlineSpeed } from 'react-icons/md'
import { getImageDataURL } from '@renderer/utils/ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { ControllerGroupDetail, ControllerProxiesDetail, ControllerMixedGroup } from '@renderer/utils/protocol'

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

export const ProxyGroupCard: React.FC<Props> = ({
  group,
  groupIndex,
  isOpen,
  toggleOpen,
  delaying,
  onGroupDelay,
  getCurrentDelay,
  mutate,
  getDelayColor
}) => {
  const { appConfig } = useAppConfig()
  const currentDelay = getCurrentDelay(group)
  const { delayThresholds = { good: 200, fair: 500 } } = appConfig || {}

  const delayColor =
    currentDelay === -1
      ? 'text-default-400'
      : currentDelay === 0
        ? 'text-danger'
        : currentDelay < delayThresholds.good
          ? 'text-success'
          : currentDelay < delayThresholds.fair
            ? 'text-warning'
            : 'text-danger'

  // Icon handling
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

  // Active Glow Style
  const activeStyle = isOpen 
    ? "bg-background/60 backdrop-blur-xl border-primary/20 shadow-[0_8px_32px_rgba(var(--heroui-primary),0.15)] scale-[1.01]" 
    : "bg-default-100/60 dark:bg-default-50/60 backdrop-blur-md border-default-200/60 shadow-sm hover:bg-default-100/80 hover:border-default-300/50"

  return (
    <div className="w-full pt-2 px-2">
      <Card
        as="div"
        isPressable
        fullWidth
        onPress={() => toggleOpen(groupIndex)}
        className={`transition-all duration-300 border group ${activeStyle}`}
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
                      {group.all.filter(p => p.history?.some(h => h.delay > 0)).length}
                      <span className="opacity-40 mx-0.5">/</span>
                      {group.all.length}
                    </span>
                    <div className={`ml-2 w-1.5 h-1.5 rounded-full transition-colors duration-500 ${
                      currentDelay === -1 ? 'bg-default-300' :
                      currentDelay === 0 ? 'bg-danger shadow-[0_0_8px_rgba(243,18,96,0.4)] animate-pulse' :
                      currentDelay < delayThresholds.good ? 'bg-success shadow-[0_0_8px_rgba(23,201,100,0.4)] animate-pulse' :
                      currentDelay < delayThresholds.fair ? 'bg-warning shadow-[0_0_8px_rgba(245,165,36,0.4)] animate-pulse' :
                      'bg-danger shadow-[0_0_8px_rgba(243,18,96,0.4)] animate-pulse'
                    }`} />
                  </div>


                </div>
              </div>
            </div>

            {/* Right: Controls & Delay */}
            <div className="flex items-center gap-3">
              {/* Current Node (Inline) */}
              <div className="flex items-center gap-2 mr-2 border-r border-default-200/50 pr-4">
                 <span className="text-sm font-medium text-foreground/90 max-w-[120px] truncate" title={group.now}>
                   {group.now}
                 </span>
              </div>

              {/* Current Delay Pill */}
              <div className="flex flex-col items-end mr-1">
                 <span className={`text-base font-bold font-mono ${delayColor} transition-colors duration-300`}>
                  {currentDelay === -1 ? '--' : currentDelay === 0 ? 'TIMEOUT' : `${currentDelay}ms`}
                </span>
                <span className="text-[10px] text-default-400 uppercase tracking-wider font-medium">Latency</span>
              </div>

              {isOpen && (
                <div className="flex items-center animate-appearance-in" onClick={(e) => e.stopPropagation()}>

                  <Button
                    variant="flat"
                    color="primary"
                    isLoading={delaying}
                    size="sm"
                    isIconOnly
                    radius="lg"
                    className="bg-primary/10 hover:bg-primary/20 text-primary"
                    onPress={() => onGroupDelay(groupIndex)}
                  >
                    <MdOutlineSpeed className="text-lg" />
                  </Button>
                </div>
              )}
            </div>
          </div>




        </CardBody>
      </Card>
    </div>
  )
}
