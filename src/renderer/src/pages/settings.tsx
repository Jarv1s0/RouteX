import { Button } from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import { IoLogoGithub } from 'react-icons/io5'
import GeneralConfig from '@renderer/components/settings/general-config'
import AdvancedSettings from '@renderer/components/settings/advanced-settings'
import Actions from '@renderer/components/settings/actions'

import AppearanceConfig from '@renderer/components/settings/appearance-confis'

const Settings: React.FC = () => {
  return (
    <BasePage
      title="应用设置"
      header={
        <>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            className="app-nodrag"
            title="GitHub 仓库"
            onPress={() => {
              window.open('https://github.com/Jarv1s0/RouteX')
            }}
          >
            <IoLogoGithub className="text-lg" />
          </Button>

        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
        {/* 左栏 */}
        <div className="flex flex-col">
          <GeneralConfig />
          <AdvancedSettings />
        </div>
        {/* 右栏 */}
        <div className="flex flex-col">
          <AppearanceConfig />
          <Actions />
        </div>
      </div>
    </BasePage>
  )
}

export default Settings
