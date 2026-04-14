import { Button, Switch, Tooltip } from '@heroui/react'
import BorderSwitch from '@renderer/components/base/border-switch'
import { useLocation } from 'react-router-dom'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { triggerSysProxy } from '@renderer/utils/mihomo-ipc'
import { SEND, sendIpc } from '@renderer/utils/ipc-channels'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { navigateSidebarRoute } from '@renderer/routes'
import { LuGlobe } from 'react-icons/lu'
import React from 'react'

interface Props {
  iconOnly?: boolean
  compact?: boolean
}

const SysproxySwitcher: React.FC<Props> = (props) => {
  const { iconOnly, compact } = props
  const location = useLocation()
  const match = location.pathname.includes('/sysproxy')
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    sysProxy,
    sysproxyCardStatus = '',
    onlyActiveDevice = false
  } = appConfig || {}
  const { enable, mode } = sysProxy || {}
  const { controledMihomoConfig } = useControledMihomoConfig()
  const { 'mixed-port': mixedPort } = controledMihomoConfig || {}

  const disabled = mixedPort == 0
  const onChange = async (enable: boolean): Promise<void> => {
    if (mode == 'manual' && disabled) return
    try {
      await triggerSysProxy(enable, onlyActiveDevice)
      await patchAppConfig({ sysProxy: { enable } })
      sendIpc(SEND.updateFloatingWindow)
      sendIpc(SEND.updateTrayMenu)
    } catch (e) {
      alert(e)
    }
  }

  if (iconOnly) {
    return (
      <div className={`flex justify-center`}>
        <Tooltip content="系统代理" placement="right">
          <Button
            size="sm"
            isIconOnly
            color={match ? 'primary' : 'default'}
            variant={match ? 'solid' : 'light'}
            onPress={() => {
              navigateSidebarRoute('/sysproxy')
            }}
          >
            <LuGlobe className="text-[16px]" />
          </Button>
        </Tooltip>
      </div>
    )
  }

  if (compact) {
    return (
      <div
        onClick={() => navigateSidebarRoute('/sysproxy')}
        className={`${sysproxyCardStatus} sysproxy-card flex h-full flex-1 items-center justify-between gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors group ${
          match ? CARD_STYLES.SIDEBAR_ACTIVE : CARD_STYLES.SIDEBAR_ITEM
        }`}
      >
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
            <LuGlobe className={`text-[15px] transition-colors text-default-700 dark:text-default-300 group-hover:text-foreground`} />
          </span>
          <span className={`text-sm font-semibold whitespace-nowrap leading-none transition-colors text-foreground dark:text-foreground/90 group-hover:text-foreground`}>
            系统代理
          </span>
        </div>
        <div onClick={(e) => e.stopPropagation()} className="shrink-0 flex items-center pr-0 -mr-0.5">
          <Switch
            size="sm"
            isSelected={!(mode != 'auto' && disabled) && enable}
            isDisabled={mode == 'manual' && disabled}
            onValueChange={onChange}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={() => navigateSidebarRoute('/sysproxy')}
      className={`${sysproxyCardStatus} sysproxy-card flex flex-1 items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors group ${
        match ? CARD_STYLES.SIDEBAR_ACTIVE : CARD_STYLES.SIDEBAR_ITEM
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
          <LuGlobe className={`text-[16px] transition-colors ${match ? 'text-primary' : 'text-default-500 group-hover:text-primary'}`} />
        </span>
        <h3 className={`text-sm font-semibold transition-colors ${match ? 'text-primary' : 'text-foreground/90 group-hover:text-primary'}`}>
          系统代理
        </h3>
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <BorderSwitch
          isShowBorder={match && enable}
          isSelected={!(mode != 'auto' && disabled) && enable}
          isDisabled={mode == 'manual' && disabled}
          onValueChange={onChange}
        />
      </div>
    </div>
  )
}

export default SysproxySwitcher
