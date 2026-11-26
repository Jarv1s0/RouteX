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
                ? 'text-foreground bg-primary/14 dark:bg-primary/20 border-transparent backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_2px_8px_rgba(0,112,243,0.1)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_8px_rgba(0,112,243,0.18)] font-semibold'
                : 'border-transparent text-default-700 dark:text-default-300 hover:text-foreground hover:bg-white/60 dark:hover:bg-white/[0.08] hover:border-white/65 dark:hover:border-white/15 font-medium'
            )}
          >
            <span className="flex items-center gap-1.5">
              <m.icon
                className={clsx(
                  'text-base',
                  isActive ? 'text-primary' : 'text-default-500 dark:text-default-400'
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
    <div className={`relative overflow-hidden antialiased p-1 ${CARD_STYLES.ROUNDED} ${CARD_STYLES.INACTIVE}`}>
      {content}
    </div>
  )
}

export default OutboundModeSwitcher
