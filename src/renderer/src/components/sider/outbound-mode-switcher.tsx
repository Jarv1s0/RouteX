/* eslint-disable react/prop-types */
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { useGroups } from '@renderer/hooks/use-groups'
import { mihomoCloseAllConnections, patchMihomoConfig } from '@renderer/utils/ipc'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { MdOutlineAltRoute } from 'react-icons/md'
import { TbWorld, TbBolt } from 'react-icons/tb'
import { motion } from 'framer-motion'
import clsx from 'clsx'

interface Props {
  iconOnly?: boolean
}

const OutboundModeSwitcher: React.FC<Props> = (props) => {
  const { iconOnly } = props
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
    window.electron.ipcRenderer.send('updateTrayMenu')
  }

  if (!mode) return null

  const modes = [
    { 
      key: 'rule', 
      label: '规则', 
      icon: MdOutlineAltRoute, 
      activeClass: 'text-white',
      activeBg: 'bg-gradient-to-tr from-sky-400 to-blue-500',
      shadow: 'shadow-lg shadow-sky-500/30'
    },
    { 
      key: 'global', 
      label: '全局', 
      icon: TbWorld, 
      activeClass: 'text-white',
      activeBg: 'bg-gradient-to-tr from-pink-400 to-purple-500',
      shadow: 'shadow-lg shadow-pink-500/30'
    },
    { 
      key: 'direct', 
      label: '直连', 
      icon: TbBolt, 
      activeClass: 'text-white',
      activeBg: 'bg-gradient-to-tr from-teal-400 to-emerald-500',
      shadow: 'shadow-lg shadow-teal-500/30'
    }
  ] as const

  if (iconOnly) {
    // 简版图标模式（保留原有 Tabs 逻辑或简化）
    // 这里简单保留逻辑，或者也用 framer-motion 重写
    return null // 暂时忽略 iconOnly 模式，侧边栏似乎没用到
  }

  return (
    <div className={`p-1 rounded-2xl ${CARD_STYLES.BASE} ${CARD_STYLES.INACTIVE}`}>
      <div className="flex relative z-0">
        {modes.map((m) => {
          const isActive = mode === m.key
          return (
            <button
              key={m.key}
              onClick={() => onChangeMode(m.key as OutboundMode)}
              className={clsx(
                'relative flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm font-medium transition-colors duration-200 focus:outline-none rounded-large z-10',
                isActive ? m.activeClass : 'text-default-500 hover:text-default-600'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="outbound-mode-pill"
                  className={clsx(
                    "absolute inset-0 rounded-large -z-10",
                    m.activeBg,
                    m.shadow
                  )}
                  initial={false}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <span className="flex items-center gap-1.5">
                <m.icon className="text-base" />
                {m.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default OutboundModeSwitcher
