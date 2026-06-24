import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { useGroups } from '@renderer/hooks/use-groups'
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
  const { mutate: mutateGroups } = useGroups()
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
        persistMode: (nextMode) => patchControledMihomoConfig({ mode: nextMode })
      })
      if (!success) return
      mutateGroups()
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
              'relative flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm transition-colors duration-200 rounded-xl z-10 box-border',
              isActive
                ? 'text-foreground dark:text-foreground bg-primary/30 dark:bg-primary/30 backdrop-blur-md border-transparent shadow-sm font-semibold'
                : 'text-default-700 dark:text-default-300 hover:text-foreground dark:hover:text-foreground hover:bg-primary/10 dark:hover:bg-primary/20 font-medium'
            )}
          >
            <span className="flex items-center gap-1.5">
              <m.icon
                className={clsx(
                  'text-base',
                  isActive
                    ? 'text-foreground/70 dark:text-foreground/60'
                    : 'text-default-600 dark:text-default-300'
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
    <div className={`p-1 rounded-2xl ${CARD_STYLES.BASE} ${CARD_STYLES.INACTIVE}`}>{content}</div>
  )
}

export default OutboundModeSwitcher
