/* eslint-disable react/prop-types */
import { Tabs, Tab } from '@heroui/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { useGroups } from '@renderer/hooks/use-groups'
import { mihomoCloseAllConnections, patchMihomoConfig } from '@renderer/utils/ipc'
import { Key } from 'react'

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
  const cursorColor = mode === 'rule' ? 'bg-purple-200' : mode === 'global' ? 'bg-orange-200' : 'bg-blue-200'
  
  return (
    <Tabs
      fullWidth
      selectedKey={mode}
      classNames={{
        tabList: 'bg-content1 shadow-medium outbound-mode-card',
        cursor: cursorColor
      }}
      onSelectionChange={(key: Key) => onChangeMode(key as OutboundMode)}
    >
      <Tab className={`text-[15px] ${mode === 'rule' ? 'font-bold' : ''}`} key="rule" title={<span style={{ color: '#9333ea' }}>规则</span>} />
      <Tab className={`text-[15px] ${mode === 'global' ? 'font-bold' : ''}`} key="global" title={<span style={{ color: '#f97316' }}>全局</span>} />
      <Tab className={`text-[15px] ${mode === 'direct' ? 'font-bold' : ''}`} key="direct" title={<span style={{ color: '#3b82f6' }}>直连</span>} />
    </Tabs>
  )
}

export default OutboundModeSwitcher
