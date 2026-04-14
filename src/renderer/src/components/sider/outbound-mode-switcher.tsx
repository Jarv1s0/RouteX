import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { useGroups } from '@renderer/hooks/use-groups'
import { mihomoCloseAllConnections, patchMihomoConfig } from '@renderer/utils/mihomo-ipc'
import { SEND, sendIpc } from '@renderer/utils/ipc-channels'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { MdOutlineAltRoute } from 'react-icons/md'
import { TbWorld, TbBolt } from 'react-icons/tb'
import clsx from 'clsx'

interface Props {
  iconOnly?: boolean
  isMinimal? : boolean
}

const OutboundModeSwitcher: React.FC<Props> = (props) => {
  const { iconOnly, isMinimal } = props
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { mutate: mutateGroups } = useGroups()
  const { appConfig } = useAppConfig()
  const { autoCloseConnection = true } = appConfig || {}
  const { mode } = controledMihomoConfig || {}

  const onChangeMode = async (newMode: OutboundMode): Promise<void> => {
    if (mode === newMode) return
    await patchControledMihomoConfig({ mode: newMode })
    await patchMihomoConfig({ mode: newMode })
    if (autoCloseConnection) {
      await mihomoCloseAllConnections()
    }
    mutateGroups()
    sendIpc(SEND.updateTrayMenu)
  }

  if (!mode) return null

  const modes = [
    { key: 'rule', label: '规则', icon: MdOutlineAltRoute },
    { key: 'global', label: '全局', icon: TbWorld },
    { key: 'direct', label: '直连', icon: TbBolt }
  ] as const

  if (iconOnly) {
    return null
  }

  const content = (
    <div className="flex relative z-0 w-full gap-1">
      {modes.map((m) => {
        const isActive = mode === m.key
        return (
          <button
            key={m.key}
            onClick={() => onChangeMode(m.key as OutboundMode)}
            className={clsx(
              'relative flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm transition-colors duration-200 rounded-xl z-10 box-border',
              isActive
                ? 'text-foreground dark:text-foreground bg-primary/30 dark:bg-primary/30 backdrop-blur-md border-transparent shadow-sm font-semibold'
                : 'text-default-700 dark:text-default-300 hover:text-foreground dark:hover:text-foreground hover:bg-primary/10 dark:hover:bg-primary/20 font-medium'
            )}
          >
            <span className="flex items-center gap-1.5">
              <m.icon className={clsx('text-base', isActive ? 'text-foreground/70 dark:text-foreground/60' : 'text-default-600 dark:text-default-300')} />
              {m.label}
            </span>
          </button>
        )
      })}
    </div>
  )

  if (isMinimal) {
    return content
  }

  return (
    <div className={`p-1 rounded-2xl ${CARD_STYLES.BASE} ${CARD_STYLES.INACTIVE}`}>
      {content}
    </div>
  )
}

export default OutboundModeSwitcher
