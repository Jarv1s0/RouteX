import { Button, Input, Switch, Tab, Tabs } from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import EditableList from '@renderer/components/base/base-list-editor'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { restartCore, setupFirewall } from '@renderer/utils/mihomo-ipc'
import { platform } from '@renderer/utils/init'
import React, { Key, useState } from 'react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import {
  primaryInputClassNames,
  primaryNumberInputClassNames
} from '@renderer/components/settings/advanced-settings'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { notifyError } from '@renderer/utils/notify'
import { useI18n } from '@renderer/i18n'

const Tun: React.FC = () => {
  const { t } = useI18n()
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { appConfig, patchAppConfig } = useAppConfig()
  const { autoSetDNSMode = 'exec' } = appConfig || {}
  const { tun } = controledMihomoConfig || {}
  const [loading, setLoading] = useState(false)
  const {
    device = platform === 'darwin' ? undefined : 'mihomo',
    stack = 'mixed',
    'auto-route': autoRoute = true,
    'auto-redirect': autoRedirect = false,
    'auto-detect-interface': autoDetectInterface = true,
    'dns-hijack': dnsHijack = ['any:53'],
    'route-exclude-address': routeExcludeAddress = [],
    'strict-route': strictRoute = false,
    'disable-icmp-forwarding': disableIcmpForwarding = false,
    mtu = 1500
  } = tun || {}
  const [changed, setChanged] = useState(false)
  const [values, originSetValues] = useState({
    device,
    stack,
    autoRoute,
    autoRedirect,
    autoDetectInterface,
    dnsHijack,
    strictRoute,
    routeExcludeAddress,
    disableIcmpForwarding,
    mtu
  })
  const setValues = (v: typeof values): void => {
    originSetValues(v)
    setChanged(true)
  }

  const onSave = async (patch: Partial<MihomoConfig>): Promise<void> => {
    await patchControledMihomoConfig(patch)
    await restartCore()
    setChanged(false)
  }

  return (
    <>
      <BasePage
        title={t('page.tun.title')}
        header={
          changed && (
            <Button
              size="sm"
              className="app-nodrag"
              color="primary"
              onPress={() =>
                onSave({
                  tun: {
                    device: values.device,
                    stack: values.stack,
                    'auto-route': values.autoRoute,
                    'auto-redirect': values.autoRedirect,
                    'auto-detect-interface': values.autoDetectInterface,
                    'dns-hijack': values.dnsHijack,
                    'strict-route': values.strictRoute,
                    'route-exclude-address': values.routeExcludeAddress,
                    'disable-icmp-forwarding': values.disableIcmpForwarding,
                    mtu: values.mtu
                  }
                })
              }
            >
              {t('common.save')}
            </Button>
          )
        }
      >
        <div className="p-2">
          <SettingCard className="tun-settings">
            {platform === 'win32' && (
              <SettingItem title={t('tun.resetFirewall')} divider>
                <Button
                  size="sm"
                  color="primary"
                  isLoading={loading}
                  onPress={async () => {
                    setLoading(true)
                    try {
                      await setupFirewall()
                      new Notification(t('tun.resetFirewallSuccess'))
                      await restartCore()
                    } catch (e) {
                      notifyError(e, { title: t('tun.resetFirewallFailed') })
                    } finally {
                      setLoading(false)
                    }
                  }}
                >
                  {t('tun.resetFirewall')}
                </Button>
              </SettingItem>
            )}
            {platform === 'darwin' && (
              <SettingItem title={t('tun.autoSetSystemDns')} divider>
                <Tabs
                  classNames={CARD_STYLES.GLASS_TABS}
                  selectedKey={autoSetDNSMode}
                  onSelectionChange={async (key: Key) => {
                    await patchAppConfig({ autoSetDNSMode: key as 'none' | 'exec' | 'service' })
                  }}
                >
                  <Tab key="none" title={t('settings.autoDns.none')} />
                  <Tab key="exec" title={t('settings.autoDns.exec')} />
                  <Tab key="service" title={t('settings.autoDns.service')} />
                </Tabs>
              </SettingItem>
            )}
            <SettingItem title={t('tun.stack')} divider>
              <Tabs
                classNames={CARD_STYLES.GLASS_TABS}
                selectedKey={values.stack}
                onSelectionChange={(key: Key) => setValues({ ...values, stack: key as TunStack })}
              >
                <Tab key="gvisor" title="gVisor" />
                <Tab key="mixed" title="Mixed" />
                <Tab key="system" title="System" />
              </Tabs>
            </SettingItem>
            {platform !== 'darwin' && (
              <>
                <SettingItem title={t('tun.device')} divider>
                  <Input
                    size="sm"
                    className="w-[100px]"
                    classNames={primaryInputClassNames}
                    value={values.device}
                    onValueChange={(v) => {
                      setValues({ ...values, device: v })
                    }}
                  />
                </SettingItem>
                <SettingItem title={t('tun.strictRoute')} divider>
                  <Switch
                    size="sm"
                    isSelected={values.strictRoute}
                    onValueChange={(v) => {
                      setValues({ ...values, strictRoute: v })
                    }}
                  />
                </SettingItem>
              </>
            )}
            <SettingItem title={t('tun.autoRoute')} divider>
              <Switch
                size="sm"
                isSelected={values.autoRoute}
                onValueChange={(v) => {
                  setValues({ ...values, autoRoute: v })
                }}
              />
            </SettingItem>
            {platform === 'linux' && (
              <SettingItem title={t('tun.autoRedirect')} divider>
                <Switch
                  size="sm"
                  isSelected={values.autoRedirect}
                  onValueChange={(v) => {
                    setValues({ ...values, autoRedirect: v })
                  }}
                />
              </SettingItem>
            )}
            <SettingItem title={t('tun.autoDetectInterface')} divider>
              <Switch
                size="sm"
                isSelected={values.autoDetectInterface}
                onValueChange={(v) => {
                  setValues({ ...values, autoDetectInterface: v })
                }}
              />
            </SettingItem>
            <SettingItem title={t('tun.icmpForwarding')} divider>
              <Switch
                size="sm"
                isSelected={!values.disableIcmpForwarding}
                onValueChange={(v) => {
                  setValues({ ...values, disableIcmpForwarding: !v })
                }}
              />
            </SettingItem>
            <SettingItem title="MTU" divider>
              <Input
                size="sm"
                type="number"
                className="w-[100px]"
                classNames={primaryNumberInputClassNames}
                value={values.mtu.toString()}
                onValueChange={(v) => {
                  setValues({ ...values, mtu: parseInt(v) })
                }}
              />
            </SettingItem>
            <SettingItem title={t('tun.dnsHijack')} divider>
              <Input
                size="sm"
                className="w-[50%]"
                classNames={primaryInputClassNames}
                value={values.dnsHijack.join(',')}
                onValueChange={(v) => {
                  const arr = v !== '' ? v.split(',') : []
                  setValues({ ...values, dnsHijack: arr })
                }}
              />
            </SettingItem>
            <EditableList
              title={t('tun.routeExcludeAddress')}
              items={values.routeExcludeAddress}
              placeholder={t('tun.routeExcludeAddressPlaceholder')}
              onChange={(list) => setValues({ ...values, routeExcludeAddress: list as string[] })}
              divider={false}
              inputClassNames={primaryInputClassNames}
            />
          </SettingCard>
        </div>
      </BasePage>
    </>
  )
}

export default Tun
