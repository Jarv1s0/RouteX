import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { useGroupsStore } from '@renderer/store/use-groups-store'
import { SEND, sendIpc } from '@renderer/utils/ipc-channels'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { MdOutlineAltRoute } from 'react-icons/md'
import { TbWorld, TbBolt } from 'react-icons/tb'
import clsx from 'clsx'
import { useState } from 'react'
import { useI18n, type TranslationKey } from '@renderer/i18n'
import { applyOutboundModeChange } from '@renderer/utils/outbound-mode'
import { notifyError } from '@renderer/utils/notify'

interface Props {
  iconOnly?: boolean
  isMinimal?: boolean
}

const OutboundModeSwitcher: React.FC<Props> = (props) => {
  const { iconOnly, isMinimal } = props
  const { t } = useI18n()
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { appConfig } = useAppConfig()
  const { autoCloseConnection = true } = appConfig || {}
  const { mode } = controledMihomoConfig || {}
  const [switching, setSwitching] = useState(false)

  const onChangeMode = async (newMode: OutboundMode): Promise<void> => {
    if (!mode || mode === newMode || switching) return

    setSwitching(true)
    try {
      const success = await applyOutboundModeChange({
        currentMode: mode,
        nextMode: newMode,
        autoCloseConnection,
        persistMode: async (nextMode) => {
          await patchControledMihomoConfig({ mode: nextMode })
          return true
        }
      })
      if (!success) return
      void useGroupsStore.getState().fetchGroups()
      sendIpc(SEND.updateTrayMenu)
    } catch (error) {
      notifyError(error, { title: t('common.updateConfigFailed') })
    } finally {
      setSwitching(false)
    }
  }

  if (!mode) return null

  const modes = [
    { key: 'rule', labelKey: 'outbound.rule', icon: MdOutlineAltRoute },
    { key: 'global', labelKey: 'outbound.global', icon: TbWorld },
    { key: 'direct', labelKey: 'outbound.direct', icon: TbBolt }
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
            disabled={switching}
            className={clsx(
              'relative flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm border transition-[background-color,border-color,box-shadow,color,transform] duration-150 rounded-xl z-10 box-border',
              isActive
                ? 'bg-background dark:bg-default-100 text-primary border-transparent shadow-md font-semibold'
                : 'border-transparent text-default-500 dark:text-default-400 hover:text-foreground hover:bg-white/50 dark:hover:bg-white/[0.08] font-medium'
            )}
          >
            <span className="flex items-center gap-1.5">
              <m.icon
                className={clsx(
                  'text-base',
                  isActive ? 'text-primary' : 'text-current'
                )}
              />
              {t(m.labelKey as TranslationKey)}
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
    <div className={`relative antialiased p-1 ${CARD_STYLES.ROUNDED} ${CARD_STYLES.HEADER_SWITCHER}`}>
      {content}
    </div>
  )
}

export default OutboundModeSwitcher
