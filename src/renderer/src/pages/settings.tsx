import { Button, Tab, Tabs } from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import { IoLogoGithub, IoSettingsOutline, IoBuildOutline } from 'react-icons/io5'
import GeneralConfig from '@renderer/components/settings/general-config'
import AdvancedSettings from '@renderer/components/settings/advanced-settings'
import { CARD_STYLES } from '@renderer/utils/card-styles'




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
      <div className="p-2 h-full">
        <Tabs
          aria-label="Settings Options"
          color="primary"
          variant="solid"
          radius="lg"
          classNames={{
            ...CARD_STYLES.GLASS_TABS,
            tab: CARD_STYLES.GLASS_TABS.tab + ' px-4',
          }}
        >
          <Tab
            key="general"
            title={
              <div className="flex items-center gap-2">
                <IoSettingsOutline className="text-lg" />
                <span>通用</span>
              </div>
            }
          >
            <div className="flex flex-col gap-2">
              <GeneralConfig />
    
            </div>
          </Tab>
          <Tab
            key="advanced"
            title={
              <div className="flex items-center gap-2">
                <IoBuildOutline className="text-lg" />
                <span>高级</span>
              </div>
            }
          >
            <div className="flex flex-col">
              <AdvancedSettings />
            </div>
          </Tab>
        </Tabs>
      </div>
    </BasePage>
  )
}

export default Settings
