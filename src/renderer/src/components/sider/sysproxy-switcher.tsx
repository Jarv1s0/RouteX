import { Button, Tooltip } from '@heroui/react'
import BorderSwitch from '@renderer/components/base/border-switch'
import SidebarTrailingSwitch from './sidebar-trailing-switch'
import { useLocation } from 'react-router-dom'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { triggerSysProxy } from '@renderer/utils/mihomo-ipc'
import { SEND, sendIpc } from '@renderer/utils/ipc-channels'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { navigateSidebarRoute, preloadSidebarRoute } from '@renderer/routes'
import { LuGlobe } from 'react-icons/lu'
import React from 'react'
import { useI18n } from '@renderer/i18n'

interface Props {
  iconOnly?: boolean
  compact?: boolean
  headerMode?: boolean
}

const SysproxySwitcher: React.FC<Props> = (props) => {
  const { iconOnly, compact, headerMode } = props
  const { t } = useI18n()
  const location = useLocation()
  const match = location.pathname.includes('/sysproxy')
  const { appConfig, patchAppConfig } = useAppConfig()
  const { sysProxy, sysproxyCardStatus = '', onlyActiveDevice = false } = appConfig || {}
  const { enable, mode } = sysProxy || {}
  const { controledMihomoConfig } = useControledMihomoConfig()
  const { 'mixed-port': mixedPort } = controledMihomoConfig || {}

  const disabled = mixedPort == 0
  const handlePreload = (): void => {
    preloadSidebarRoute('/sysproxy')
  }
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
        <Tooltip content={t('sidebar.sysProxy')} placement="right">
          <Button
            size="sm"
            isIconOnly
            color={match ? 'primary' : 'default'}
            variant={match ? 'solid' : 'light'}
            onFocus={handlePreload}
            onMouseEnter={handlePreload}
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

  if (headerMode) {
    const isSelected = !(mode != 'auto' && disabled) && enable
    return (
      <div
        onMouseEnter={handlePreload}
        onClick={() => navigateSidebarRoute('/sysproxy')}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-xl cursor-pointer transition-colors hover:bg-default-200/50 dark:hover:bg-white/5 select-none`}
      >
        <LuGlobe className={`text-[14px] ${isSelected ? 'text-primary' : 'text-default-500'}`} />
        <span className={`text-[12px] leading-none ${isSelected ? 'font-bold text-foreground' : 'font-medium text-default-500'}`}>
          {t('sidebar.sysProxy')}
        </span>
        <div onClick={(e) => e.stopPropagation()} className="ml-0.5 flex items-center">
          <SidebarTrailingSwitch
            isSelected={isSelected}
            isDisabled={mode == 'manual' && disabled}
            onValueChange={onChange}
            size="sm"
          />
        </div>
      </div>
    )
  }

  if (compact) {
    return (
      <div
        onMouseEnter={handlePreload}
        onClick={() => navigateSidebarRoute('/sysproxy')}
        className={`${sysproxyCardStatus} sysproxy-card flex h-full flex-1 items-center justify-between gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors group ${
          match ? CARD_STYLES.SIDEBAR_ACTIVE : CARD_STYLES.SIDEBAR_ITEM
        }`}
      >
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
            <LuGlobe
              className={`text-[15px] transition-colors text-default-700 dark:text-default-300 group-hover:text-foreground`}
            />
          </span>
          <span
            className={`text-sm font-semibold whitespace-nowrap leading-none transition-colors text-foreground dark:text-foreground/90 group-hover:text-foreground`}
          >
            {t('sidebar.sysProxy')}
          </span>
        </div>
        <SidebarTrailingSwitch
          isSelected={!(mode != 'auto' && disabled) && enable}
          isDisabled={mode == 'manual' && disabled}
          onValueChange={onChange}
        />
      </div>
    )
  }

  return (
    <div
      onMouseEnter={handlePreload}
      onClick={() => navigateSidebarRoute('/sysproxy')}
      className={`${sysproxyCardStatus} sysproxy-card flex flex-1 items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors group ${
        match ? CARD_STYLES.SIDEBAR_ACTIVE : CARD_STYLES.SIDEBAR_ITEM
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
          <LuGlobe
            className={`text-[16px] transition-colors ${match ? 'text-primary' : 'text-default-500 group-hover:text-primary'}`}
          />
        </span>
        <h3
          className={`text-sm font-semibold transition-colors ${match ? 'text-primary' : 'text-foreground/90 group-hover:text-primary'}`}
        >
          {t('sidebar.sysProxy')}
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
