import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '@heroui/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { useGroupsStore } from '@renderer/store/use-groups-store'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { SEND, sendIpc } from '@renderer/utils/ipc-channels'
import { LuChevronDown, LuGlobe, LuSplit, LuZap } from 'react-icons/lu'
import clsx from 'clsx'
import { useState } from 'react'
import { useI18n, type TranslationKey } from '@renderer/i18n'
import { applyOutboundModeChange } from '@renderer/utils/outbound-mode'
import { notifyError } from '@renderer/utils/notify'

interface Props {
  iconOnly?: boolean
  isMinimal?: boolean
  headerMode?: boolean
}

const OUTBOUND_MODES = [
  {
    key: 'rule',
    labelKey: 'outbound.rule',
    icon: LuSplit,
    colorClass: 'text-primary'
  },
  {
    key: 'global',
    labelKey: 'outbound.global',
    icon: LuGlobe,
    colorClass: 'text-rose-500 dark:text-rose-400'
  },
  {
    key: 'direct',
    labelKey: 'outbound.direct',
    icon: LuZap,
    colorClass: 'text-emerald-600 dark:text-emerald-400'
  }
] as const

const OutboundModeSwitcher: React.FC<Props> = (props) => {
  const { iconOnly, isMinimal, headerMode } = props
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

  if (iconOnly) {
    return null
  }

  if (headerMode) {
    const activeMode = OUTBOUND_MODES.find((m) => m.key === mode) || OUTBOUND_MODES[0]
    const ActiveIcon = activeMode.icon

    return (
      <Dropdown
        classNames={{
          ...CARD_STYLES.GLASS_DROPDOWN,
          content: `${CARD_STYLES.GLASS_DROPDOWN.content} !min-w-[116px] p-1`
        }}
        placement="bottom-end"
      >
        <DropdownTrigger>
          <button
            type="button"
            disabled={switching}
            className={clsx(
              'flex h-8 items-center gap-1 px-2.5 rounded-full cursor-pointer transition-[background-color,color] duration-150 select-none',
              'bg-background dark:bg-default-100',
              activeMode.colorClass,
              switching && 'opacity-60 cursor-wait'
            )}
          >
            <ActiveIcon className="text-[14px] text-current" strokeWidth={2} />
            <span className="text-[12px] leading-none font-medium text-current">
              {t(activeMode.labelKey as TranslationKey)}
            </span>
            <LuChevronDown className="text-[12px] text-current opacity-65" strokeWidth={2} />
          </button>
        </DropdownTrigger>
        <DropdownMenu
          aria-label="Outbound mode"
          className="min-w-0 p-0"
          itemClasses={{
            base: 'rounded-xl px-2.5 py-1.5 gap-2'
          }}
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={new Set([mode])}
          onAction={(key) => {
            void onChangeMode(key as OutboundMode)
          }}
        >
          {OUTBOUND_MODES.map((m) => (
            <DropdownItem
              key={m.key}
              className={clsx(mode === m.key && clsx('font-medium', m.colorClass))}
              startContent={<m.icon className={clsx('text-base', m.colorClass)} />}
            >
              {t(m.labelKey as TranslationKey)}
            </DropdownItem>
          ))}
        </DropdownMenu>
      </Dropdown>
    )
  }

  const content = (
    <div className="flex relative z-0 w-full gap-1">
      {OUTBOUND_MODES.map((m) => {
        const isActive = mode === m.key
        return (
          <button
            key={m.key}
            onClick={() => onChangeMode(m.key as OutboundMode)}
            disabled={switching}
            className={clsx(
              'relative flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm border transition-[background-color,border-color,box-shadow,color,transform] duration-150 rounded-xl z-10 box-border',
              isActive
                ? 'bg-primary/10 dark:bg-primary/15 text-primary border-transparent font-semibold'
                : 'border-transparent text-foreground/75 hover:text-foreground hover:bg-white/50 dark:hover:bg-white/[0.08] font-medium'
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
    <div className="relative rounded-2xl bg-white/35 p-1 antialiased outline outline-offset-[-1px] outline-white/40 dark:bg-black/20 dark:outline-white/10">
      {content}
    </div>
  )
}

export default OutboundModeSwitcher
