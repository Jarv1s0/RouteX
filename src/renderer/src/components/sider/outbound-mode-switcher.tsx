/* eslint-disable react/prop-types */
import { Tabs, Tab } from '@heroui/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { useGroups } from '@renderer/hooks/use-groups'
import { mihomoCloseAllConnections, patchMihomoConfig } from '@renderer/utils/ipc'
import { Key } from 'react'
import { MdOutlineAltRoute } from 'react-icons/md'
import { TbWorld, TbBolt } from 'react-icons/tb'

interface Props {
  iconOnly?: boolean
}

const OutboundModeSwitcher: React.FC<Props> = (props) => {
  const { iconOnly } = props
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { mutate: mutateGroups } = useGroups()
  const { appConfig } = useAppConfig()
  const { autoCloseConnection = true } = appConfig || {}
  const { mode } = controledMihomoConfig || {}

  const onChangeMode = async (mode: OutboundMode): Promise<void> => {
    await patchControledMihomoConfig({ mode })
    await patchMihomoConfig({ mode })
    if (autoCloseConnection) {
      await mihomoCloseAllConnections()
    }
    mutateGroups()
    window.electron.ipcRenderer.send('updateTrayMenu')
  }
  if (!mode) return null
  if (iconOnly) {
    return (
      <Tabs
        color="primary"
        selectedKey={mode}
        classNames={{
          tabList: 'bg-content1 shadow-medium outbound-mode-card flex-col'
        }}
        onSelectionChange={(key: Key) => onChangeMode(key as OutboundMode)}
      >
        <Tab className={`${mode === 'rule' ? 'font-bold' : ''}`} key="rule" title="R" />
        <Tab className={`${mode === 'global' ? 'font-bold' : ''}`} key="global" title="G" />
        <Tab className={`${mode === 'direct' ? 'font-bold' : ''}`} key="direct" title="D" />
      </Tabs>
    )
  }
  const cursorColor = mode === 'rule' ? 'bg-sky-500/30' : mode === 'global' ? 'bg-pink-300/30' : 'bg-teal-500/30'

  return (
    <Tabs
      selectedKey={mode}
      classNames={{
        base: 'w-full',
        tabList: 'bg-content1 shadow-medium grid grid-cols-3 w-full',
        cursor: cursorColor
      }}
      onSelectionChange={(key: Key) => onChangeMode(key as OutboundMode)}
    >
      <Tab className={`text-[15px] ${mode === 'rule' ? 'font-bold' : ''}`} key="rule" title={<span className="flex items-center justify-center gap-1 text-sky-500"><MdOutlineAltRoute className="text-[16px]" />规则</span>} />
      <Tab className={`text-[15px] ${mode === 'global' ? 'font-bold' : ''}`} key="global" title={<span className="flex items-center justify-center gap-1 text-pink-300"><TbWorld className="text-[16px]" />全局</span>} />
      <Tab className={`text-[15px] ${mode === 'direct' ? 'font-bold' : ''}`} key="direct" title={<span className="flex items-center justify-center gap-1 text-teal-500"><TbBolt className="text-[16px]" />直连</span>} />
    </Tabs>
  )
}

export default OutboundModeSwitcher
