import { Button, Card, CardBody } from '@heroui/react'
import { MdOutlineSpeed } from 'react-icons/md'
import { getImageDataURL } from '@renderer/utils/resource-ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useEffect, useState, memo } from 'react'
import { addFlag } from '@renderer/utils/flags'
import { CARD_STYLES } from '@renderer/utils/card-styles'


interface Props {
  group: ControllerMixedGroup
  isOpen: boolean
  toggleOpen: () => void
  searchValue: string
  updateSearchValue: (value: string) => void
  delaying: boolean
  onGroupDelay: () => Promise<void>
  getCurrentDelay: (group: ControllerMixedGroup) => number
  mutate: () => void
  getDelayColor: (proxy: ControllerProxiesDetail | ControllerGroupDetail) => string
}

const ProxyGroupCardComponent: React.FC<Props> = ({
  group,
  isOpen,
  toggleOpen,
  delaying,
  onGroupDelay,
  getCurrentDelay
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

  // Icon: 用局部 state 缓存已解析的 dataURL，避免触发全局 mutate
  const [iconSrc, setIconSrc] = useState<string>(() => {
    if (!group.icon) return ''
    if (group.icon.startsWith('<svg')) return `data:image/svg+xml;utf8,${group.icon}`
    // 初始化时同步读一次缓存；之后不在渲染路径外再读 localStorage
    return localStorage.getItem(group.icon) || group.icon
  })

  useEffect(() => {
    if (!group.icon || !group.icon.startsWith('http')) return
    const cached = localStorage.getItem(group.icon)
    if (cached) {
      setIconSrc(cached)
      return
    }
    let cancelled = false
    getImageDataURL(group.icon).then((dataURL) => {
      if (cancelled) return
      localStorage.setItem(group.icon, dataURL)
      setIconSrc(dataURL)
    })
    return () => { cancelled = true }
  }, [group.icon])

  // Active Glow Style
  // Active Glow Style
  const activeStyle = isOpen
    ? "bg-gradient-to-br from-default-100/92 to-default-50/88 border-default-200/70 shadow-[inset_0_-1px_0_rgba(255,255,255,0.3),0_6px_18px_rgba(15,23,42,0.05)] relative"
    : "bg-default-50/56 dark:bg-default-50/18 border-white/10 dark:border-white/6 shadow-sm hover:bg-default-100/72 hover:border-default-200/32 hover:shadow"

  return (
    <div className="w-full pt-2 px-2">
      <Card
        as="div"
        isPressable
        fullWidth
        onPress={toggleOpen}
        className={`${CARD_STYLES.BASE} group ${activeStyle} data-[pressed=true]:scale-[0.995]`}
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
                    src={iconSrc || group.icon}
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
                    <span className={`text-[10px] font-bold uppercase tracking-wider mr-2 transition-colors duration-500 ${
                      currentDelay === -1 ? 'text-default-400' :
                      currentDelay === 0 ? 'text-default-400' :
                      currentDelay < delayThresholds.good ? 'text-success' :
                      currentDelay < delayThresholds.fair ? 'text-warning' :
                      'text-danger'
                    }`}>Live</span>
                    <span className="text-xs font-mono font-medium text-foreground/80">
                      {(group.all || []).filter(p => p.history?.some(h => h.delay > 0)).length}
                      <span className="opacity-40 mx-0.5">/</span>
                      {(group.all || []).length}
                    </span>
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
                    onPress={onGroupDelay}
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
           <div className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full bg-gradient-to-r from-transparent via-primary/55 to-transparent" />
        )}
      </Card>
    </div>
  )
}

export const ProxyGroupCard = memo(ProxyGroupCardComponent, (prev, next) => {
  // 只在真正影响渲染的 props 变化时才重渲染
  return (
    prev.isOpen === next.isOpen &&
    prev.delaying === next.delaying &&
    prev.searchValue === next.searchValue &&
    prev.group.name === next.group.name &&
    prev.group.now === next.group.now &&
    prev.group.icon === next.group.icon &&
    prev.group.all?.length === next.group.all?.length &&
    prev.getCurrentDelay(prev.group) === next.getCurrentDelay(next.group)
  )
})
