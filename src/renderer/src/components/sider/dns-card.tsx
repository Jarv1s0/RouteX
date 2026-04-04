import { Button, Tooltip } from '@heroui/react'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import BorderSwitch from '@renderer/components/base/border-switch'
import { LuServer } from 'react-icons/lu'
import { useLocation, useNavigate } from 'react-router-dom'
import { patchMihomoConfig } from '@renderer/utils/mihomo-ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import React from 'react'
import { CARD_STYLES } from '@renderer/utils/card-styles'

interface Props {
  iconOnly?: boolean
  isMinimal?: boolean
}

const DNSCard: React.FC<Props> = (props) => {
  const { appConfig } = useAppConfig()
  const { iconOnly, isMinimal } = props
  const { controlDns = true } = appConfig || {}
  const location = useLocation()
  const navigate = useNavigate()
  const match = location.pathname.includes('/dns')
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { dns } = controledMihomoConfig || {}
  const { enable = true } = dns || {}

  const onChange = async (enable: boolean): Promise<void> => {
    await patchControledMihomoConfig({ dns: { enable } })
    await patchMihomoConfig({ dns: { enable } })
  }

  if (!controlDns) return null

  if (iconOnly) {
    return (
      <div className={`flex justify-center`}>
        <Tooltip content="DNS" placement="right">
          <Button
            size="sm"
            isIconOnly
            color={match ? 'primary' : 'default'}
            variant={match ? 'solid' : 'light'}
            onPress={() => navigate('/dns')}
          >
            <LuServer className="text-[16px]" />
          </Button>
        </Tooltip>
      </div>
    )
  }

  if (isMinimal) {
    return (
      <Tooltip content="DNS 配置" placement="top">
        <div
          className={`flex items-center justify-center p-2 rounded-lg cursor-pointer transition-all ${
            match ? CARD_STYLES.SIDEBAR_ACTIVE : `${CARD_STYLES.SIDEBAR_ITEM} text-foreground/80`
          }`}
          onClick={() => navigate('/dns')}
        >
          <LuServer className={`text-[16px] ${enable ? 'text-blue-500' : 'text-default-400'}`} />
        </div>
      </Tooltip>
    )
  }

  return (
    <div
      className={`dns-card flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all group ${
        match ? CARD_STYLES.SIDEBAR_ACTIVE : CARD_STYLES.SIDEBAR_ITEM
      }`}
      onClick={() => navigate('/dns')}
    >
      <div className="flex items-center gap-2">
        <LuServer className={`text-[16px] transition-colors text-default-500 dark:text-default-400 group-hover:text-primary`} />
        <span className={`text-sm font-semibold transition-colors text-foreground/90 dark:text-foreground/80 group-hover:text-foreground`}>DNS</span>
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <BorderSwitch isShowBorder={match && enable} isSelected={enable} onValueChange={onChange} />
      </div>
    </div>
  )
}

export default DNSCard
