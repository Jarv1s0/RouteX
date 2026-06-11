import { Button, Tab, Tabs } from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import { useCallback, useRef, useState } from 'react'
import { MdTune } from 'react-icons/md'
import { useSearchParams } from 'react-router-dom'
import { useI18n } from '@renderer/i18n'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import ProfileSettingModal from '@renderer/components/profiles/profile-setting-modal'
import { OverrideConfigProvider } from '@renderer/hooks/use-override-config'

import { ProfileTabContent } from '@renderer/components/profiles/profile-tab-content'
import { OverrideTabContent } from '@renderer/components/profiles/override-tab-content'
import { ProviderTabContent } from '@renderer/components/profiles/provider-tab-content'

type ManagementTab = 'profiles' | 'overrides' | 'providers'

function normalizeManagementTab(tab: string | null): ManagementTab {
  if (tab === 'overrides' || tab === 'providers') {
    return tab
  }
  return 'profiles'
}

const ProfilesPage: React.FC = () => {
  const { t } = useI18n()
  const pageRef = useRef<HTMLDivElement>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = normalizeManagementTab(searchParams.get('tab'))
  const [isSettingModalOpen, setIsSettingModalOpen] = useState(false)
  const [toolbarContainer, setToolbarContainer] = useState<HTMLDivElement | null>(null)

  const handleTabChange = useCallback(
    (key: string) => {
      const nextTab = normalizeManagementTab(key)
      const nextParams = new URLSearchParams(searchParams)
      if (nextTab === 'profiles') {
        nextParams.delete('tab')
      } else {
        nextParams.set('tab', nextTab)
      }
      setSearchParams(nextParams, { replace: true })
    },
    [searchParams, setSearchParams]
  )

  const pageTitle =
    activeTab === 'overrides'
      ? t('page.profiles.overridesTitle')
      : activeTab === 'providers'
        ? t('page.profiles.providersTitle')
        : t('page.profiles.title')

  const titleContent = (
    <div className="flex items-center gap-2">
      <span>{pageTitle}</span>
      {activeTab === 'profiles' && (
        <Button
          size="sm"
          title={t('page.profiles.settings')}
          className="h-6 w-6 min-w-0 app-nodrag text-default-500"
          variant="light"
          isIconOnly
          onPress={() => setIsSettingModalOpen(true)}
        >
          <MdTune className="text-base" />
        </Button>
      )}
    </div>
  )

  return (
    <BasePage ref={pageRef} title={titleContent}>
      {isSettingModalOpen && <ProfileSettingModal onClose={() => setIsSettingModalOpen(false)} />}

      <div className="sticky top-0 z-40 w-full bg-transparent px-2 pb-2 pt-2 pointer-events-none">
        <div
          ref={setToolbarContainer}
          className={`w-full flex items-center gap-2 px-2 py-1.5 pointer-events-auto ${CARD_STYLES.GLASS_TOOLBAR} ${CARD_STYLES.ROUNDED}`}
        >
          <Tabs
            size="md"
            variant="solid"
            radius="lg"
            selectedKey={activeTab}
            onSelectionChange={(key) => handleTabChange(String(key))}
            classNames={CARD_STYLES.GLASS_TABS}
          >
            <Tab key="profiles" title={t('page.profiles.profilesTab')} />
            <Tab key="overrides" title={t('page.profiles.overridesTab')} />
            <Tab key="providers" title={t('page.profiles.providersTab')} />
          </Tabs>
        </div>
      </div>

      <div className="flex-1 w-full relative">
        {activeTab === 'profiles' && <ProfileTabContent toolbarContainer={toolbarContainer} />}
        {activeTab === 'overrides' && <OverrideTabContent toolbarContainer={toolbarContainer} />}
        {activeTab === 'providers' && <ProviderTabContent toolbarContainer={toolbarContainer} />}
      </div>
    </BasePage>
  )
}

const Profiles: React.FC = () => {
  return (
    <OverrideConfigProvider>
      <ProfilesPage />
    </OverrideConfigProvider>
  )
}

export default Profiles
