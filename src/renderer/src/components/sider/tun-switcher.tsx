import { Button, Tooltip } from '@heroui/react'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import BorderSwitch from '@renderer/components/base/border-switch'
import SidebarTrailingSwitch from './sidebar-trailing-switch'
import { LuNetwork } from 'react-icons/lu'
import { useLocation } from 'react-router-dom'
import { restartCore } from '@renderer/utils/mihomo-ipc'
import React from 'react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { platform } from '@renderer/utils/init'
import { SEND, sendIpc } from '@renderer/utils/ipc-channels'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { navigateSidebarRoute, preloadSidebarRoute } from '@renderer/routes'
import { notifyError } from '@renderer/utils/notify'
import { checkElevateTask } from '@renderer/utils/service-ipc'
import { useI18n } from '@renderer/i18n'

interface Props {
  iconOnly?: boolean
  compact?: boolean
  headerMode?: boolean
}

async function showToastError(title: string, description: string): Promise<void> {
  const { toast } = await import('sonner')
  toast.error(title, { description })
}

function isLikelyPermissionError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    (normalized.includes('permission') ||
      normalized.includes('privilege') ||
      normalized.includes('operation not permitted') ||
      normalized.includes('access is denied')) &&
    !message.includes('现有虚拟网卡状态')
  )
}

const TunSwitcher: React.FC<Props> = (props) => {
  const { iconOnly, compact, headerMode } = props
  const { t } = useI18n()
  const location = useLocation()
  const match = location.pathname.includes('/tun') || false
  const { appConfig } = useAppConfig()
  const { tunCardStatus = '' } = appConfig || {}
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { tun, dns } = controledMihomoConfig || {}
  const { enable } = tun || {}
  const handlePreload = (): void => {
    preloadSidebarRoute('/tun')
  }

  const onChange = async (enable: boolean): Promise<void> => {
    try {
      if (enable && platform === 'win32' && __ROUTEX_HOST__ === 'tauri' && !import.meta.env.DEV) {
        const hasElevateTask = await checkElevateTask()
        if (!hasElevateTask) {
          await showToastError(t('tun.startFailed'), t('tray.enableTunFirst'))
          return
        }
      }

      const previousTun = tun ? { ...tun } : undefined
      const previousDns = dns ? { ...dns } : undefined

      const patch = enable ? { tun: { enable }, dns: { enable: true } } : { tun: { enable } }
      const patched = await patchControledMihomoConfig(patch)
      if (!patched) {
        return
      }

      try {
        await restartCore()
      } catch (error) {
        await patchControledMihomoConfig({
          tun: previousTun,
          ...(enable ? { dns: previousDns } : {})
        })
        throw error
      }
      sendIpc(SEND.updateFloatingWindow)
      sendIpc(SEND.updateTrayMenu)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      if (enable && isLikelyPermissionError(errorMessage)) {
        await showToastError(t('tun.startFailed'), t('tun.permissionDenied'))
      } else if (enable && errorMessage.includes('现有虚拟网卡状态')) {
        await showToastError(t('tun.startFailed'), t('tun.staleState'))
      } else if (enable) {
        notifyError(error, { title: t('tun.startFailed') })
      } else {
        notifyError(error, { title: t('tun.stopFailed') })
      }

      console.error('Failed to toggle TUN:', error)
    }
  }

  if (iconOnly) {
    return (
      <div className={`flex justify-center`}>
        <Tooltip content={t('sidebar.tun')} placement="right">
          <Button
            size="sm"
            isIconOnly
            color={match ? 'primary' : 'default'}
            variant={match ? 'solid' : 'light'}
            onFocus={handlePreload}
            onMouseEnter={handlePreload}
            onPress={() => {
              navigateSidebarRoute('/tun')
            }}
          >
            <LuNetwork className="text-[16px]" />
          </Button>
        </Tooltip>
      </div>
    )
  }

  if (headerMode) {
    const isSelected = enable ?? false
    return (
      <div
        onMouseEnter={handlePreload}
        onClick={() => navigateSidebarRoute('/tun')}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-xl cursor-pointer transition-colors hover:bg-default-200/50 dark:hover:bg-white/5 select-none`}
      >
        <LuNetwork className={`text-[14px] ${isSelected ? 'text-primary' : 'text-default-500'}`} />
        <span
          className={`text-[12px] leading-none ${isSelected ? 'font-bold text-foreground' : 'font-medium text-default-500'}`}
        >
          {t('sidebar.tun')}
        </span>
        <div onClick={(e) => e.stopPropagation()} className="ml-0.5 flex items-center">
          <SidebarTrailingSwitch isSelected={isSelected} onValueChange={onChange} size="sm" />
        </div>
      </div>
    )
  }

  if (compact) {
    return (
      <div
        onMouseEnter={handlePreload}
        onClick={() => navigateSidebarRoute('/tun')}
        className={`${tunCardStatus} tun-card flex h-full flex-1 items-center justify-between gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors group ${
          match ? CARD_STYLES.SIDEBAR_ACTIVE : CARD_STYLES.SIDEBAR_ITEM
        }`}
      >
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
            <LuNetwork
              className={`text-[15px] transition-colors text-default-700 dark:text-default-300 group-hover:text-foreground`}
            />
          </span>
          <span
            className={`text-sm font-semibold whitespace-nowrap leading-none transition-colors text-foreground dark:text-foreground/90 group-hover:text-foreground`}
          >
            {t('sidebar.tun')}
          </span>
        </div>
        <SidebarTrailingSwitch isSelected={enable} onValueChange={onChange} />
      </div>
    )
  }

  return (
    <div
      onMouseEnter={handlePreload}
      onClick={() => navigateSidebarRoute('/tun')}
      className={`${tunCardStatus} tun-card flex flex-1 items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors group ${
        match ? CARD_STYLES.SIDEBAR_ACTIVE : CARD_STYLES.SIDEBAR_ITEM
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
          <LuNetwork
            className={`text-[16px] transition-colors ${match ? 'text-primary' : 'text-default-500 group-hover:text-primary'}`}
          />
        </span>
        <h3
          className={`text-sm font-semibold transition-colors ${match ? 'text-primary' : 'text-foreground/90 group-hover:text-primary'}`}
        >
          {t('sidebar.tun')}
        </h3>
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <BorderSwitch isShowBorder={match && enable} isSelected={enable} onValueChange={onChange} />
      </div>
    </div>
  )
}

export default TunSwitcher
