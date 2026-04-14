import { Button, Switch, Tooltip } from '@heroui/react'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import BorderSwitch from '@renderer/components/base/border-switch'
import { LuNetwork } from 'react-icons/lu'
import { useLocation } from 'react-router-dom'
import { restartCore } from '@renderer/utils/mihomo-ipc'
import React from 'react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { platform } from '@renderer/utils/init'
import { SEND, sendIpc } from '@renderer/utils/ipc-channels'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { navigateSidebarRoute } from '@renderer/routes'
import { notifyError } from '@renderer/utils/notify'
import { checkElevateTask } from '@renderer/utils/service-ipc'

interface Props {
  iconOnly?: boolean
  compact?: boolean
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
  const { iconOnly, compact } = props
  const location = useLocation()
  const match = location.pathname.includes('/tun') || false
  const { appConfig } = useAppConfig()
  const { tunCardStatus = '' } = appConfig || {}
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { tun, dns } = controledMihomoConfig || {}
  const { enable } = tun || {}

  const onChange = async (enable: boolean): Promise<void> => {
    try {
      if (enable && platform === 'win32' && __ROUTEX_HOST__ === 'tauri') {
        const hasElevateTask = await checkElevateTask()
        if (!hasElevateTask) {
          await showToastError('TUN模式启动失败', '请先到内核设置里注册提权任务，再启用虚拟网卡')
          return
        }
      }

      const previousTun = tun ? { ...tun } : undefined
      const previousDns = dns ? { ...dns } : undefined

      if (enable) {
        await patchControledMihomoConfig({ tun: { enable }, dns: { enable: true } })
      } else {
        await patchControledMihomoConfig({ tun: { enable } })
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
        await showToastError('TUN模式启动失败', '当前错误是权限不足，请以管理员身份运行 RouteX')
      } else if (enable && errorMessage.includes('现有虚拟网卡状态')) {
        await showToastError('TUN模式启动失败', '当前更像是旧的 Wintun/核心状态残留，请先关闭旧实例后再试')
      } else if (enable) {
        notifyError(error, { title: 'TUN模式启动失败' })
      } else {
        notifyError(error, { title: 'TUN模式关闭失败' })
      }

      console.error('TUN切换失败:', error)
    }
  }

  if (iconOnly) {
    return (
      <div className={`flex justify-center`}>
        <Tooltip content="虚拟网卡" placement="right">
          <Button
            size="sm"
            isIconOnly
            color={match ? 'primary' : 'default'}
            variant={match ? 'solid' : 'light'}
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

  if (compact) {
    return (
      <div
        onClick={() => navigateSidebarRoute('/tun')}
        className={`${tunCardStatus} tun-card flex h-full flex-1 items-center justify-between gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors group ${
          match ? CARD_STYLES.SIDEBAR_ACTIVE : CARD_STYLES.SIDEBAR_ITEM
        }`}
      >
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
            <LuNetwork className={`text-[15px] transition-colors text-default-700 dark:text-default-300 group-hover:text-foreground`} />
          </span>
          <span className={`text-sm font-semibold whitespace-nowrap leading-none transition-colors text-foreground dark:text-foreground/90 group-hover:text-foreground`}>
            虚拟网卡
          </span>
        </div>
        <div onClick={(e) => e.stopPropagation()} className="shrink-0 flex items-center pr-0 -mr-0.5">
          <Switch
            size="sm"
            isSelected={enable}
            onValueChange={onChange}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={() => navigateSidebarRoute('/tun')}
      className={`${tunCardStatus} tun-card flex flex-1 items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors group ${
        match ? CARD_STYLES.SIDEBAR_ACTIVE : CARD_STYLES.SIDEBAR_ITEM
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
          <LuNetwork className={`text-[16px] transition-colors ${match ? 'text-primary' : 'text-default-500 group-hover:text-primary'}`} />
        </span>
        <h3 className={`text-sm font-semibold transition-colors ${match ? 'text-primary' : 'text-foreground/90 group-hover:text-primary'}`}>
          虚拟网卡
        </h3>
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <BorderSwitch
          isShowBorder={match && enable}
          isSelected={enable}
          onValueChange={onChange}
        />
      </div>
    </div>
  )
}

export default TunSwitcher
