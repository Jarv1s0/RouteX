import { Button } from '@heroui/react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import {
  quitApp,
  quitWithoutCore,
  resetAppConfig
} from '@renderer/utils/ipc'
import { useState } from 'react'
import { version } from '@renderer/utils/init'
import ConfirmModal from '../base/base-confirm'

const Actions: React.FC = () => {
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <>
      {confirmOpen && (
        <ConfirmModal
          onChange={setConfirmOpen}
          title="确认删除配置？"
          description={
            <>
              ⚠️ 删除配置，
              <span className="text-red-500">操作不可撤销</span>
            </>
          }
          confirmText="确认删除"
          cancelText="取消"
          onConfirm={resetAppConfig}
        />
      )}
      <SettingCard title="更多设置">

        <SettingItem title="重置软件" divider>
          <Button size="sm" variant="flat" onPress={() => setConfirmOpen(true)}>
            重置软件
          </Button>
        </SettingItem>

        <SettingItem title="保留内核退出" divider>
          <Button size="sm" variant="flat" onPress={quitWithoutCore}>
            退出
          </Button>
        </SettingItem>
        <SettingItem title="退出应用" divider>
          <Button size="sm" variant="flat" onPress={quitApp}>
            退出应用
          </Button>
        </SettingItem>
        <SettingItem title="应用版本">
          <div>v{version}</div>
        </SettingItem>
      </SettingCard>
    </>
  )
}

export default Actions
