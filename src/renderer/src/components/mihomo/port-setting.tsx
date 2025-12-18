import React, { useState } from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import EditableList from '../base/base-list-editor'

import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { restartCore, startSubStoreBackendServer, triggerSysProxy } from '@renderer/utils/ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { platform } from '@renderer/utils/init'
import { Button, Input, Switch } from '@heroui/react'
import { secondaryInputClassNames } from '../settings/advanced-settings'
import { FaNetworkWired } from 'react-icons/fa'
import InterfaceModal from '@renderer/components/mihomo/interface-modal'

const PortSetting: React.FC = () => {
  const { appConfig } = useAppConfig()
  const { sysProxy, onlyActiveDevice = false } = appConfig || {}
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const {
    authentication = [],
    'skip-auth-prefixes': skipAuthPrefixes = ['127.0.0.1/32'],
    'allow-lan': allowLan,
    'lan-allowed-ips': lanAllowedIps = [],
    'lan-disallowed-ips': lanDisallowedIps = [],
    'mixed-port': mixedPort = 7890,
    'socks-port': socksPort = 0,
    port: httpPort = 0,
    'redir-port': redirPort = 0,
    'tproxy-port': tproxyPort = 0
  } = controledMihomoConfig || {}

  const [mixedPortInput, setMixedPortInput] = useState(mixedPort)
  const [socksPortInput, setSocksPortInput] = useState(socksPort)
  const [httpPortInput, setHttpPortInput] = useState(httpPort)
  const [redirPortInput, setRedirPortInput] = useState(redirPort)
  const [tproxyPortInput, setTproxyPortInput] = useState(tproxyPort)
  const [lanAllowedIpsInput, setLanAllowedIpsInput] = useState(lanAllowedIps)
  const [lanDisallowedIpsInput, setLanDisallowedIpsInput] = useState(lanDisallowedIps)
  const [authenticationInput, setAuthenticationInput] = useState(authentication)
  const [skipAuthPrefixesInput, setSkipAuthPrefixesInput] = useState(skipAuthPrefixes)
  const [lanOpen, setLanOpen] = useState(false)

  const parseAuth = (item: string): { part1: string; part2: string } => {
    const [user = '', pass = ''] = item.split(':')
    return { part1: user, part2: pass }
  }
  const formatAuth = (user: string, pass?: string): string => `${user}:${pass || ''}`
  const hasPortConflict = (): boolean => {
    const ports = [
      mixedPortInput,
      socksPortInput,
      httpPortInput,
      redirPortInput,
      tproxyPortInput
    ].filter((p) => p !== 0)
    return new Set(ports).size !== ports.length
  }

  const onChangeNeedRestart = async (patch: Partial<MihomoConfig>): Promise<void> => {
    await patchControledMihomoConfig(patch)
    await restartCore()
  }

  return (
    <>
      {lanOpen && <InterfaceModal onClose={() => setLanOpen(false)} />}
      <SettingCard title="端口设置" collapsible>
        <div className="text-sm text-foreground-600 bg-content2 rounded-lg p-1 mt-2">
          <div className="ml-2">
            <SettingItem title="混合端口" divider>
          <div className="flex">
            {mixedPortInput !== mixedPort && (
              <Button
                size="sm"
                color="primary"
                className="mr-2"
                isDisabled={hasPortConflict()}
                onPress={async () => {
                  await onChangeNeedRestart({ 'mixed-port': mixedPortInput })
                  await startSubStoreBackendServer()
                  if (sysProxy?.enable) {
                    triggerSysProxy(true, onlyActiveDevice)
                  }
                }}
              >
                确认
              </Button>
            )}
            <Input
              size="sm"
              type="number"
              className="w-[100px]"
              classNames={secondaryInputClassNames}
              value={mixedPortInput.toString()}
              max={65535}
              min={0}
              onValueChange={(v) => {
                setMixedPortInput(parseInt(v) || 0)
              }}
            />
          </div>
        </SettingItem>
        <SettingItem title="Socks 端口" divider>
          <div className="flex">
            {socksPortInput !== socksPort && (
              <Button
                size="sm"
                color="primary"
                className="mr-2"
                isDisabled={hasPortConflict()}
                onPress={() => {
                  onChangeNeedRestart({ 'socks-port': socksPortInput })
                }}
              >
                确认
              </Button>
            )}

            <Input
              size="sm"
              type="number"
              className="w-[100px]"
              classNames={secondaryInputClassNames}
              value={socksPortInput.toString()}
              max={65535}
              min={0}
              onValueChange={(v) => {
                setSocksPortInput(parseInt(v) || 0)
              }}
            />
          </div>
        </SettingItem>
        <SettingItem title="Http 端口" divider>
          <div className="flex">
            {httpPortInput !== httpPort && (
              <Button
                size="sm"
                color="primary"
                className="mr-2"
                isDisabled={hasPortConflict()}
                onPress={() => {
                  onChangeNeedRestart({ port: httpPortInput })
                }}
              >
                确认
              </Button>
            )}

            <Input
              size="sm"
              type="number"
              className="w-[100px]"
              classNames={secondaryInputClassNames}
              value={httpPortInput.toString()}
              max={65535}
              min={0}
              onValueChange={(v) => {
                setHttpPortInput(parseInt(v) || 0)
              }}
            />
          </div>
        </SettingItem>
        {platform !== 'win32' && (
          <SettingItem title="Redir 端口" divider>
            <div className="flex">
              {redirPortInput !== redirPort && (
                <Button
                  size="sm"
                  color="primary"
                  className="mr-2"
                  isDisabled={hasPortConflict()}
                  onPress={() => {
                    onChangeNeedRestart({ 'redir-port': redirPortInput })
                  }}
                >
                  确认
                </Button>
              )}

              <Input
                size="sm"
                type="number"
                className="w-[100px]"
                classNames={secondaryInputClassNames}
                value={redirPortInput.toString()}
                max={65535}
                min={0}
                onValueChange={(v) => {
                  setRedirPortInput(parseInt(v) || 0)
                }}
              />
            </div>
          </SettingItem>
        )}
        {platform === 'linux' && (
          <SettingItem title="TProxy 端口" divider>
            <div className="flex">
              {tproxyPortInput !== tproxyPort && (
                <Button
                  size="sm"
                  color="primary"
                  className="mr-2"
                  isDisabled={hasPortConflict()}
                  onPress={() => {
                    onChangeNeedRestart({ 'tproxy-port': tproxyPortInput })
                  }}
                >
                  确认
                </Button>
              )}

              <Input
                size="sm"
                type="number"
                className="w-[100px]"
                classNames={secondaryInputClassNames}
                value={tproxyPortInput.toString()}
                max={65535}
                min={0}
                onValueChange={(v) => {
                  setTproxyPortInput(parseInt(v) || 0)
                }}
              />
            </div>
          </SettingItem>
        )}
        <SettingItem
          title="允许局域网连接"
          actions={
            <Button
              size="sm"
              isIconOnly
              variant="light"
              onPress={() => {
                setLanOpen(true)
              }}
            >
              <FaNetworkWired className="text-lg" />
            </Button>
          }
          divider
        >
          <Switch
            size="sm"
            isSelected={allowLan}
            onValueChange={(v) => {
              onChangeNeedRestart({ 'allow-lan': v })
            }}
          />
        </SettingItem>
        {allowLan && (
          <div className="text-sm text-foreground-600 bg-content2 rounded-lg p-3 mt-2 mb-4">
            <div className="ml-4 text-sm">
              <SettingItem title="允许连接的 IP 段">
                {lanAllowedIpsInput.join('') !== lanAllowedIps.join('') && (
                  <Button
                    size="sm"
                    color="primary"
                    onPress={() => {
                      onChangeNeedRestart({ 'lan-allowed-ips': lanAllowedIpsInput })
                    }}
                  >
                    确认
                  </Button>
                )}
              </SettingItem>
              <div className="text-xs text-foreground-500 bg-content3 rounded-lg p-2 mt-1 mb-3">
                <div className="ml-6">
                  <EditableList
                    items={lanAllowedIpsInput}
                    onChange={(items) => setLanAllowedIpsInput(items as string[])}
                    placeholder="IP 段"
                  />
                </div>
              </div>
              <SettingItem title="禁止连接的 IP 段">
                {lanDisallowedIpsInput.join('') !== lanDisallowedIps.join('') && (
                  <Button
                    size="sm"
                    color="primary"
                    onPress={() => {
                      onChangeNeedRestart({ 'lan-disallowed-ips': lanDisallowedIpsInput })
                    }}
                  >
                    确认
                  </Button>
                )}
              </SettingItem>
              <div className="text-xs text-foreground-500 bg-content3 rounded-lg p-2 mt-1 mb-3">
                <div className="ml-6">
                  <EditableList
                    items={lanDisallowedIpsInput}
                    onChange={(items) => setLanDisallowedIpsInput(items as string[])}
                    placeholder="IP 段"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
        <SettingItem title="用户验证">
          <Switch
            size="sm"
            isSelected={authenticationInput.length > 0}
            onValueChange={(v) => {
              if (!v) {
                setAuthenticationInput([])
                onChangeNeedRestart({ authentication: [] })
              }
            }}
          />
        </SettingItem>
        {authenticationInput.length > 0 && (
          <div className="text-sm text-foreground-600 bg-content2 rounded-lg p-3 mt-2 mb-4">
            <div className="ml-4 text-sm">
              <SettingItem title="用户验证列表">
                {authenticationInput.join() !== authentication.join() && (
                  <Button
                    size="sm"
                    color="primary"
                    onPress={() => onChangeNeedRestart({ authentication: authenticationInput })}
                  >
                    确认
                  </Button>
                )}
              </SettingItem>
              <div className="text-xs text-foreground-500 bg-content3 rounded-lg p-2 mt-1 mb-3">
                <div className="ml-6">
                  <EditableList
                    items={authenticationInput}
                    onChange={(items) => setAuthenticationInput(items as string[])}
                    placeholder="用户名"
                    part2Placeholder="密码"
                    parse={parseAuth}
                    format={formatAuth}
                  />
                </div>
              </div>
              <SettingItem title="允许跳过验证的 IP 段">
                {skipAuthPrefixesInput.join('') !== skipAuthPrefixes.join('') && (
                  <Button
                    size="sm"
                    color="primary"
                    onPress={() => {
                      onChangeNeedRestart({ 'skip-auth-prefixes': skipAuthPrefixesInput })
                    }}
                  >
                    确认
                  </Button>
                )}
              </SettingItem>
              <div className="text-xs text-foreground-500 bg-content3 rounded-lg p-2 mt-1">
                <div className="ml-6">
                  <EditableList
                    items={skipAuthPrefixesInput}
                    onChange={(items) => setSkipAuthPrefixesInput(items as string[])}
                    placeholder="IP 段"
                    disableFirst
                    divider={false}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
          </div>
        </div>
      </SettingCard>
    </>
  )
}

export default PortSetting
