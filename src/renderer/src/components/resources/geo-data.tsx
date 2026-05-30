import { Button, Input, Tab, Tabs } from '@heroui/react'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { useState, useEffect, useMemo } from 'react'
import { useI18n, type TranslationKey } from '@renderer/i18n'
import { mihomoUpgradeGeoFile } from '@renderer/utils/mihomo-ipc'
import { LuCheck, LuCloudDownload, LuX } from 'react-icons/lu'

import AppSwitch from '@renderer/components/base/app-switch'

type GeoDataKey = 'geoip' | 'geosite' | 'mmdb' | 'asn'

const geoDataKeys: Array<{ key: GeoDataKey; titleKey: TranslationKey }> = [
  { key: 'geoip', titleKey: 'resources.geoip' },
  { key: 'geosite', titleKey: 'resources.geosite' },
  { key: 'mmdb', titleKey: 'resources.mmdb' },
  { key: 'asn', titleKey: 'resources.asn' }
]

const defaultGeoxUrl: Record<GeoDataKey, string> = {
  geoip: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip-lite.dat',
  geosite: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geosite.dat',
  mmdb: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip.metadb',
  asn: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/GeoLite2-ASN.mmdb'
}

const GeoData: React.FC = () => {
  const { t } = useI18n()
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const {
    'geox-url': geoxUrlRaw,
    'geodata-mode': geoMode = false,
    'geo-auto-update': geoAutoUpdate = false,
    'geo-update-interval': geoUpdateInterval = 24
  } = controledMihomoConfig || {}

  const geoxUrl = useMemo<Record<GeoDataKey, string>>(
    () => ({
      geoip: geoxUrlRaw?.geoip || defaultGeoxUrl.geoip,
      geosite: geoxUrlRaw?.geosite || defaultGeoxUrl.geosite,
      mmdb: geoxUrlRaw?.mmdb || defaultGeoxUrl.mmdb,
      asn: geoxUrlRaw?.asn || defaultGeoxUrl.asn
    }),
    [geoxUrlRaw]
  )

  const [inputs, setInputs] = useState<Record<GeoDataKey, string>>(geoxUrl)
  const [downloading, setDownloading] = useState<Partial<Record<GeoDataKey, boolean>>>({})

  useEffect(() => {
    setInputs(geoxUrl)
  }, [geoxUrl])

  const saveGeoUrl = (key: GeoDataKey): void => {
    patchControledMihomoConfig({ 'geox-url': { ...geoxUrl, [key]: inputs[key] } })
  }

  const downloadGeoFile = async (key: GeoDataKey, title: string): Promise<void> => {
    setDownloading((prev) => ({ ...prev, [key]: true }))
    try {
      await mihomoUpgradeGeoFile(key, inputs[key])
      new Notification(t('resources.downloadGeoDataItemSuccess', { name: title }))
    } catch (e) {
      alert(e)
    } finally {
      setDownloading((prev) => ({ ...prev, [key]: false }))
    }
  }

  return (
    <SettingCard>
      {geoDataKeys.map(({ key, titleKey }) => {
        const title = t(titleKey)
        return (
          <SettingItem key={key} title={title} divider>
            <div className="flex w-[82%] min-w-0 items-center gap-1.5">
              <Input
                size="sm"
                className="min-w-0 flex-1"
                value={inputs[key]}
                onValueChange={(value) => setInputs((prev) => ({ ...prev, [key]: value }))}
              />
              <div className="relative flex shrink-0 items-center h-8 min-w-[70px] justify-end">
                <div
                  className={`absolute right-0 flex items-center transition-all duration-150 ease-out ${
                    inputs[key] === geoxUrl[key]
                      ? 'opacity-100 scale-100'
                      : 'opacity-0 scale-75 pointer-events-none'
                  }`}
                >
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    className="min-w-8 w-8 h-8 text-default-600 dark:text-default-400 hover:text-primary"
                    isLoading={downloading[key]}
                    aria-label={t('resources.downloadGeoDataItem', { name: title })}
                    title={t('resources.downloadGeoDataItem', { name: title })}
                    onPress={() => void downloadGeoFile(key, title)}
                  >
                    <LuCloudDownload className="text-lg" />
                  </Button>
                </div>

                <div
                  className={`absolute right-0 flex items-center gap-1.5 transition-all duration-150 ease-out ${
                    inputs[key] !== geoxUrl[key]
                      ? 'opacity-100 translate-x-0'
                      : 'opacity-0 translate-x-2 pointer-events-none'
                  }`}
                >
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    className="min-w-8 w-8 h-8 text-success-600 dark:text-success-400 hover:bg-success/10"
                    aria-label={t('common.confirm')}
                    title={t('common.confirm')}
                    onPress={() => saveGeoUrl(key)}
                  >
                    <LuCheck className="text-lg" />
                  </Button>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    className="min-w-8 w-8 h-8 text-danger-600 dark:text-danger-400 hover:bg-danger/10"
                    aria-label={t('common.cancel')}
                    title={t('common.cancel')}
                    onPress={() => setInputs((prev) => ({ ...prev, [key]: geoxUrl[key] }))}
                  >
                    <LuX className="text-lg" />
                  </Button>
                </div>
              </div>
            </div>
          </SettingItem>
        )
      })}
      <SettingItem title={t('resources.geoMode')} divider>
        <Tabs
          size="sm"
          color="primary"
          variant="solid"
          radius="lg"
          selectedKey={geoMode ? 'dat' : 'db'}
          onSelectionChange={(key) => {
            patchControledMihomoConfig({ 'geodata-mode': key === 'dat' })
          }}
        >
          <Tab key="db" title="db" />
          <Tab key="dat" title="dat" />
        </Tabs>
      </SettingItem>
      <SettingItem title={t('resources.autoUpdate')} divider={geoAutoUpdate}>
        <AppSwitch
          size="sm"
          isSelected={geoAutoUpdate}
          onValueChange={(v) => {
            patchControledMihomoConfig({ 'geo-auto-update': v })
          }}
        />
      </SettingItem>
      {geoAutoUpdate && (
        <SettingItem title={t('resources.updateIntervalHours')}>
          <Input
            size="sm"
            type="number"
            className="w-[100px]"
            value={geoUpdateInterval.toString()}
            onValueChange={(v) => {
              patchControledMihomoConfig({ 'geo-update-interval': parseInt(v) })
            }}
          />
        </SettingItem>
      )}
    </SettingCard>
  )
}

export default GeoData
