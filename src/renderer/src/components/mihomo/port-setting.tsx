import React, { useState } from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import EditableList from '../base/base-list-editor'

import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { restartCore, triggerSysProxy } from '@renderer/utils/mihomo-ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { platform } from '@renderer/utils/init'
import { Button, Input, Switch } from '@heroui/react'

import { FaNetworkWired } from 'react-icons/fa'
import InterfaceModal from '@renderer/components/mihomo/interface-modal'
import { useI18n } from '@renderer/i18n'

const portInputClassNames = {
  input:
    'bg-transparent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
  inputWrapper:
    'border border-default-200 bg-default-100/50 shadow-sm rounded-2xl hover:bg-default-200/50'
}

// 端口输入子组件，整合确认按钮和 Input
const PortInput: React.FC<{
  label: string
  value: number
  current: number
  hasConflict: boolean
  onSave: () => void
  onChange: (v: number) => void
  confirmText: string
  divider?: boolean
}> = ({ label, value, current, hasConflict, onSave, onChange, confirmText, divider = true }) => (
  <SettingItem title={label} divider={divider}>
    <div className="flex items-center gap-2">
      {value !== current && (
        <Button size="sm" color="primary" isDisabled={hasConflict} onPress={onSave}>
          {confirmText}
        </Button>
      )}
      <Input
        size="sm"
        type="number"
        className="w-[100px]"
        classNames={portInputClassNames}
        value={value.toString()}
        max={65535}
        min={0}
        onValueChange={(v) => onChange(parseInt(v) || 0)}
      />
    </div>
  </SettingItem>
)

// 子面板容器，统一嵌套区域的视觉样式
const SubPanel: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = ''
}) => (
  <div className={`text-sm text-foreground-600 bg-content2 rounded-lg p-3 mt-2 mb-4 ${className}`}>
    <div className="ml-2">{children}</div>
  </div>
)

// 子面板内的列表容器
const ListPanel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-xs text-foreground-500 bg-content3 rounded-lg p-2 mt-1 mb-0 [&>div]:!mt-0">
    {children}
  </div>
)

const PortSetting: React.FC = () => {
  const { t } = useI18n()
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
      <SettingCard title={t('mihomo.portSettings')} collapsible>
        {/* ═══ 第一层：端口配置 ═══ */}
        <PortInput
          label={t('mihomo.mixedPort')}
          confirmText={t('common.confirm')}
          value={mixedPortInput}
          current={mixedPort}
          hasConflict={hasPortConflict()}
          onChange={setMixedPortInput}
          onSave={async () => {
            await onChangeNeedRestart({ 'mixed-port': mixedPortInput })
            if (sysProxy?.enable) {
              triggerSysProxy(true, onlyActiveDevice)
            }
          }}
        />
        <PortInput
          label={t('mihomo.socksPort')}
          confirmText={t('common.confirm')}
          value={socksPortInput}
          current={socksPort}
          hasConflict={hasPortConflict()}
          onChange={setSocksPortInput}
          onSave={() => onChangeNeedRestart({ 'socks-port': socksPortInput })}
        />
        <PortInput
          label={t('mihomo.httpPort')}
          confirmText={t('common.confirm')}
          value={httpPortInput}
          current={httpPort}
          hasConflict={hasPortConflict()}
          onChange={setHttpPortInput}
          onSave={() => onChangeNeedRestart({ port: httpPortInput })}
          divider
        />
        {platform !== 'win32' && (
          <PortInput
            label={t('mihomo.redirPort')}
            confirmText={t('common.confirm')}
            value={redirPortInput}
            current={redirPort}
            hasConflict={hasPortConflict()}
            onChange={setRedirPortInput}
            onSave={() => onChangeNeedRestart({ 'redir-port': redirPortInput })}
            divider={platform !== 'linux'}
          />
        )}
        {platform === 'linux' && (
          <PortInput
            label={t('mihomo.tproxyPort')}
            confirmText={t('common.confirm')}
            value={tproxyPortInput}
            current={tproxyPort}
            hasConflict={hasPortConflict()}
            onChange={setTproxyPortInput}
            onSave={() => onChangeNeedRestart({ 'tproxy-port': tproxyPortInput })}
            divider={false}
          />
        )}

        {/* ═══ 第二层：局域网连接 ═══ */}
        <SettingItem
          title={t('mihomo.allowLan')}
          actions={
            <Button size="sm" isIconOnly variant="light" onPress={() => setLanOpen(true)}>
              <FaNetworkWired className="text-lg" />
            </Button>
          }
          divider={!allowLan}
        >
          <Switch
            size="sm"
            isSelected={allowLan}
            onValueChange={(v) => onChangeNeedRestart({ 'allow-lan': v })}
          />
        </SettingItem>

        {allowLan && (
          <SubPanel>
            {/* 允许的 IP */}
            <SettingItem title={t('mihomo.lanAllowedIps')} divider>
              {lanAllowedIpsInput.join('') !== lanAllowedIps.join('') && (
                <Button
                  size="sm"
                  color="primary"
                  onPress={() => onChangeNeedRestart({ 'lan-allowed-ips': lanAllowedIpsInput })}
                >
                  {t('common.confirm')}
                </Button>
              )}
            </SettingItem>
            <ListPanel>
              <EditableList
                items={lanAllowedIpsInput}
                onChange={(items) => setLanAllowedIpsInput(items as string[])}
                placeholder={t('mihomo.ipRange')}
                divider={false}
                inputClassNames={portInputClassNames}
              />
            </ListPanel>

            {/* 禁止的 IP */}
            <SettingItem title={t('mihomo.lanDisallowedIps')}>
              {lanDisallowedIpsInput.join('') !== lanDisallowedIps.join('') && (
                <Button
                  size="sm"
                  color="primary"
                  onPress={() =>
                    onChangeNeedRestart({ 'lan-disallowed-ips': lanDisallowedIpsInput })
                  }
                >
                  {t('common.confirm')}
                </Button>
              )}
            </SettingItem>
            <ListPanel>
              <EditableList
                items={lanDisallowedIpsInput}
                onChange={(items) => setLanDisallowedIpsInput(items as string[])}
                placeholder={t('mihomo.ipRange')}
                divider={false}
                inputClassNames={portInputClassNames}
              />
            </ListPanel>
          </SubPanel>
        )}

        {/* ═══ 第三层：用户验证 ═══ */}
        <SettingItem title={t('mihomo.userAuth')}>
          <Switch
            size="sm"
            isSelected={authenticationInput.length > 0}
            onValueChange={(v) => {
              if (v) {
                if (authenticationInput.length === 0) {
                  setAuthenticationInput([''])
                }
              } else {
                setAuthenticationInput([])
                onChangeNeedRestart({ authentication: [] })
              }
            }}
          />
        </SettingItem>

        {authenticationInput.length > 0 && (
          <SubPanel>
            {/* 验证列表 */}
            <SettingItem title={t('mihomo.userAuthList')} divider>
              {authenticationInput.join() !== authentication.join() && (
                <Button
                  size="sm"
                  color="primary"
                  onPress={() => onChangeNeedRestart({ authentication: authenticationInput })}
                >
                  {t('common.confirm')}
                </Button>
              )}
            </SettingItem>
            <ListPanel>
              <EditableList
                items={authenticationInput}
                onChange={(items) => setAuthenticationInput(items as string[])}
                placeholder={t('mihomo.username')}
                part2Placeholder={t('mihomo.password')}
                parse={parseAuth}
                format={formatAuth}
                divider={false}
                inputClassNames={portInputClassNames}
              />
            </ListPanel>

            {/* 跳过验证的 IP */}
            <SettingItem title={t('mihomo.skipAuthIps')}>
              {skipAuthPrefixesInput.join('') !== skipAuthPrefixes.join('') && (
                <Button
                  size="sm"
                  color="primary"
                  onPress={() =>
                    onChangeNeedRestart({ 'skip-auth-prefixes': skipAuthPrefixesInput })
                  }
                >
                  {t('common.confirm')}
                </Button>
              )}
            </SettingItem>
            <ListPanel>
              <EditableList
                items={skipAuthPrefixesInput}
                onChange={(items) => setSkipAuthPrefixesInput(items as string[])}
                placeholder={t('mihomo.ipRange')}
                disableFirst
                divider={false}
                inputClassNames={portInputClassNames}
              />
            </ListPanel>
          </SubPanel>
        )}
      </SettingCard>
    </>
  )
}

export default PortSetting
