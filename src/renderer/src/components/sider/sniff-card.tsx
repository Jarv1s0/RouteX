import { Button, Tooltip } from '@heroui/react'
import BorderSwitch from '@renderer/components/base/border-switch'
import { LuScanSearch } from 'react-icons/lu'
import { useLocation, useNavigate } from 'react-router-dom'
import { patchMihomoConfig } from '@renderer/utils/mihomo-ipc'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import React from 'react'
import { CARD_STYLES } from '@renderer/utils/card-styles'

interface Props {
  iconOnly?: boolean
  isMinimal?: boolean
}

const SniffCard: React.FC<Props> = (props) => {
  const { appConfig } = useAppConfig()
  const { iconOnly, isMinimal } = props
  const { controlSniff = true } = appConfig || {}
  const location = useLocation()
  const navigate = useNavigate()
  const match = location.pathname.includes('/sniffer')
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { sniffer } = controledMihomoConfig || {}
  const { enable } = sniffer || {}

  const onChange = async (enable: boolean): Promise<void> => {
    await patchControledMihomoConfig({ sniffer: { enable } })
    await patchMihomoConfig({ sniffer: { enable } })
  }

  if (!controlSniff) return null

  if (iconOnly) {
    return (
      <div className={`flex justify-center`}>
        <Tooltip content="域名嗅探" placement="right">
          <Button
            size="sm"
            isIconOnly
            color={match ? 'primary' : 'default'}
            variant={match ? 'solid' : 'light'}
            onPress={() => navigate('/sniffer')}
          >
            <LuScanSearch className="text-[16px]" />
          </Button>
        </Tooltip>
      </div>
    )
  }

  if (isMinimal) {
    return (
      <Tooltip content="域名嗅探配置" placement="top">
        <div
          className={`flex items-center justify-center p-2 rounded-lg cursor-pointer transition-all ${
            match ? CARD_STYLES.SIDEBAR_ACTIVE : `${CARD_STYLES.SIDEBAR_ITEM} text-foreground/80`
          }`}
          onClick={() => navigate('/sniffer')}
        >
          <LuScanSearch className={`text-[16px] ${enable ? 'text-green-500' : 'text-default-400'}`} />
        </div>
      </Tooltip>
    )
  }

  return (
    <div
      className={`sniff-card flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all group ${
        match ? CARD_STYLES.SIDEBAR_ACTIVE : CARD_STYLES.SIDEBAR_ITEM
      }`}
      onClick={() => navigate('/sniffer')}
    >
      <div className="flex items-center gap-2">
        <LuScanSearch className={`text-[16px] transition-colors text-default-500 dark:text-default-400 group-hover:text-primary`} />
        <span className={`text-sm font-semibold transition-colors text-foreground/90 dark:text-foreground/80 group-hover:text-foreground`}>域名嗅探</span>
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <BorderSwitch isShowBorder={match && enable} isSelected={enable} onValueChange={onChange} />
      </div>
    </div>
  )
}

export default SniffCard
