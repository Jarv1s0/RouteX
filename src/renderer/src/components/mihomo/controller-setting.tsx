import React, { useEffect, useState } from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { Button, Input, Select, SelectItem, Switch, Tooltip } from '@heroui/react'
import { openExternalUrl } from '@renderer/api/app'
import { mihomoUpgradeUI, restartCore } from '@renderer/utils/mihomo-ipc'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import EditableList from '../base/base-list-editor'
import { IoMdCloudDownload, IoMdRefresh } from 'react-icons/io'
import { HiExternalLink } from 'react-icons/hi'
import { AiOutlineEye, AiOutlineEyeInvisible } from 'react-icons/ai'
import { isValidListenAddress } from '@renderer/utils/validate'

const inputClassNames = {
  input: 'bg-transparent',
  inputWrapper:
    'border border-default-200 bg-default-100/50 shadow-sm rounded-2xl hover:bg-default-200/50'
}

function getExternalUiName(externalUiUrl: string): string {
  if (externalUiUrl.includes('zashboard')) {
    return 'zashboard'
  }
  if (externalUiUrl.includes('metacubexd')) {
    return 'metacubexd-gh-pages'
  }
  return 'ui'
}

function getExternalUiPath(externalUiUrl: string): string {
  return `ui/${getExternalUiName(externalUiUrl)}`
}

function normalizeExternalUiPath(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/\/+$/, '')
}

function normalizeControllerForBrowser(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''

  if (trimmed.startsWith(':')) {
    return `127.0.0.1${trimmed}`
  }

  const ipv6Match = trimmed.match(/^\[([^\]]+)\]:(\d+)$/)
  if (ipv6Match) {
    const [, host, port] = ipv6Match
    const normalizedHost = host === '::' ? '127.0.0.1' : `[${host}]`
    return `${normalizedHost}:${port}`
  }

  const separatorIndex = trimmed.lastIndexOf(':')
  if (separatorIndex > 0) {
    const host = trimmed.slice(0, separatorIndex).trim()
    const port = trimmed.slice(separatorIndex + 1).trim()
    const normalizedHost =
      host === '' || host === '*' || host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host
    return `${normalizedHost}:${port}`
  }

  return trimmed
}

function buildExternalUiOpenUrl(
  controller: string,
  uiPath: string,
  externalUiUrl: string,
  secret: string
): string {
  const controllerUrl = new URL(`http://${controller}`)
  const host = controllerUrl.hostname
  const port = controllerUrl.port
  const normalizedUiPath = uiPath.trim() || 'ui'
  const uiBaseUrl = new URL('/ui/', controllerUrl)

  if (normalizedUiPath.includes('zashboard') || externalUiUrl.includes('zashboard')) {
    const hashParams = new URLSearchParams({
      hostname: host,
      port
    })
    if (secret) {
      hashParams.set('secret', secret)
    }
    uiBaseUrl.hash = `/setup?${hashParams.toString()}`
    return uiBaseUrl.toString()
  }

  if (normalizedUiPath.includes('metacubexd') || externalUiUrl.includes('metacubexd')) {
    const hashParams = new URLSearchParams({
      hostname: host,
      port
    })
    if (secret) {
      hashParams.set('secret', secret)
    }
    uiBaseUrl.hash = `/setup?${hashParams.toString()}`
    return uiBaseUrl.toString()
  }

  uiBaseUrl.searchParams.set('hostname', host)
  uiBaseUrl.searchParams.set('port', port)
  if (secret) {
    uiBaseUrl.searchParams.set('secret', secret)
  }
  return uiBaseUrl.toString()
}

function resolveExternalUiOpenUrl(
  controller: string,
  uiPath: string,
  externalUiUrl: string,
  secret: string
): string | null {
  const normalizedController = normalizeControllerForBrowser(controller)
  if (!normalizedController) {
    return null
  }

  try {
    return buildExternalUiOpenUrl(normalizedController, uiPath, externalUiUrl, secret)
  } catch {
    return null
  }
}

const ControllerSetting: React.FC = () => {
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const {
    'external-controller': externalController = '',
    'external-ui': externalUi = '',
    'external-ui-url': externalUiUrl = '',
    'external-ui-name': externalUiName = '',
    'external-controller-cors': externalControllerCors,
    secret
  } = controledMihomoConfig || {}
  const {
    'allow-origins': allowOrigins = [],
    'allow-private-network': allowPrivateNetwork = true
  } = externalControllerCors || {}

  const initialAllowOrigins = allowOrigins.length == 1 && allowOrigins[0] == '*' ? [] : allowOrigins
  const [allowOriginsInput, setAllowOriginsInput] = useState(initialAllowOrigins)
  const [externalControllerInput, setExternalControllerInput] = useState(externalController)
  const [externalUiUrlInput, setExternalUiUrlInput] = useState(externalUiUrl)
  const [secretInput, setSecretInput] = useState(secret)
  const [enableExternalUi, setEnableExternalUi] = useState(externalUi.trim() !== '')
  const [upgrading, setUpgrading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [externalControllerError, setExternalControllerError] = useState<string | null>(() => {
    const r = isValidListenAddress(externalController)
    return r.ok ? null : (r.error ?? '格式错误')
  })
  const persistedExternalController = externalController.trim()
  const persistedExternalUi = normalizeExternalUiPath(externalUi)
  const hasExternalController = persistedExternalController !== ''
  const expectedExternalUi = getExternalUiPath(externalUiUrlInput)
  const expectedExternalUiName = getExternalUiName(externalUiUrlInput)
  const externalUiPathChanged =
    enableExternalUi &&
    (persistedExternalUi !== expectedExternalUi || externalUiName !== expectedExternalUiName)
  const browserOpenUrl =
    enableExternalUi && hasExternalController
      ? resolveExternalUiOpenUrl(
          persistedExternalController,
          persistedExternalUi,
          externalUiUrl,
          secret
        )
      : null

  useEffect(() => {
    setAllowOriginsInput(allowOrigins.length == 1 && allowOrigins[0] == '*' ? [] : allowOrigins)
    setExternalControllerInput(externalController)
    setExternalUiUrlInput(externalUiUrl)
    setSecretInput(secret)
    setEnableExternalUi(externalUi.trim() !== '')

    const result = isValidListenAddress(externalController)
    setExternalControllerError(result.ok ? null : (result.error ?? '格式错误'))
  }, [allowOrigins, externalController, externalUi, externalUiUrl, secret])

  const upgradeUI = async (): Promise<void> => {
    try {
      setUpgrading(true)
      await mihomoUpgradeUI()
      new Notification('面板更新成功')
    } catch (e) {
      alert(e)
    } finally {
      setUpgrading(false)
    }
  }
  const onChangeNeedRestart = async (patch: Partial<MihomoConfig>): Promise<void> => {
    await patchControledMihomoConfig(patch)
    await restartCore()
    if ('external-ui-url' in patch) {
      setTimeout(async () => {
        await upgradeUI()
      }, 1000)
    }
  }
  const generateRandomString = (length: number): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  return (
    <SettingCard title="外部控制器" collapsible>
      <SettingItem title="监听地址" divider>
        <div className="flex">
          {externalControllerInput != externalController && !externalControllerError && (
            <Button
              size="sm"
              color="primary"
              className="mr-2"
              isDisabled={!!externalControllerError}
              onPress={() => {
                onChangeNeedRestart({
                  'external-controller': externalControllerInput
                })
              }}
            >
              确认
            </Button>
          )}
          <Tooltip
            content={externalControllerError}
            placement="right"
            isOpen={!!externalControllerError}
            showArrow={true}
            color="danger"
            offset={10}
          >
            <Input
              size="sm"
              className={`w-[200px] ${externalControllerError ? 'border-danger ring-1 ring-danger rounded-2xl' : ''}`}
              classNames={externalControllerError ? undefined : inputClassNames}
              value={externalControllerInput}
              onValueChange={(v) => {
                setExternalControllerInput(v)
                const r = isValidListenAddress(v)
                setExternalControllerError(r.ok ? null : (r.error ?? '格式错误'))
              }}
            />
          </Tooltip>
        </div>
      </SettingItem>
      <SettingItem
        title="访问密钥"
        actions={
          <Button
            size="sm"
            isIconOnly
            title="生成密钥"
            variant="light"
            onPress={() => setSecretInput(generateRandomString(32))}
          >
            <IoMdRefresh className="text-lg" />
          </Button>
        }
        divider
      >
        <div className="flex">
          {secretInput != secret && (
            <Button
              size="sm"
              color="primary"
              className="mr-2"
              onPress={() => {
                onChangeNeedRestart({ secret: secretInput })
              }}
            >
              确认
            </Button>
          )}
          <Input
            size="sm"
            type={showPassword ? 'text' : 'password'}
            className="w-[200px]"
            classNames={inputClassNames}
            value={secretInput}
            onValueChange={setSecretInput}
            startContent={
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="text-gray-500 hover:text-gray-700"
              >
                {showPassword ? (
                  <AiOutlineEyeInvisible className="w-4 h-4" />
                ) : (
                  <AiOutlineEye className="w-4 h-4" />
                )}
              </button>
            }
          />
        </div>
      </SettingItem>
      <SettingItem title="启用控制器面板" divider>
        <Switch
          size="sm"
          isSelected={enableExternalUi}
          onValueChange={(v) => {
            setEnableExternalUi(v)
            onChangeNeedRestart({
              'external-ui': v ? getExternalUiPath(externalUiUrlInput) : undefined,
              'external-ui-name': v ? getExternalUiName(externalUiUrlInput) : undefined
            })
          }}
        />
      </SettingItem>
      {enableExternalUi && (
        <SettingItem
          title="控制器面板"
          divider
          actions={
            <>
              <Button
                size="sm"
                isIconOnly
                title="更新面板"
                variant="light"
                isLoading={upgrading}
                onPress={upgradeUI}
              >
                <IoMdCloudDownload className="text-lg" />
              </Button>
              <Button
                title="在浏览器中打开"
                isIconOnly
                size="sm"
                className="app-nodrag"
                variant="light"
                isDisabled={upgrading || !browserOpenUrl || externalUiPathChanged}
                onPress={() => {
                  if (!browserOpenUrl) {
                    alert('当前控制器面板地址无效，请先确认监听地址和面板配置已生效')
                    return
                  }

                  void openExternalUrl(browserOpenUrl).catch((error) => {
                    alert(error)
                  })
                }}
              >
                <HiExternalLink className="text-lg" />
              </Button>
            </>
          }
        >
          <div className="flex">
            {(externalUiUrlInput != externalUiUrl || externalUiPathChanged) && (
              <Button
                size="sm"
                color="primary"
                className="mr-2"
                onPress={() => {
                  onChangeNeedRestart({
                    'external-ui': enableExternalUi
                      ? getExternalUiPath(externalUiUrlInput)
                      : undefined,
                    'external-ui-url': externalUiUrlInput,
                    'external-ui-name': enableExternalUi
                      ? getExternalUiName(externalUiUrlInput)
                      : undefined
                  })
                }}
              >
                确认
              </Button>
            )}
            <Select
              classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
              className="w-[150px]"
              size="sm"
              selectedKeys={new Set([externalUiUrlInput])}
              disallowEmptySelection={true}
              onSelectionChange={(v) => {
                const newUrl = v.currentKey as string
                setExternalUiUrlInput(newUrl)
              }}
            >
              <SelectItem key="https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip">
                zashboard
              </SelectItem>
              <SelectItem key="https://github.com/MetaCubeX/metacubexd/archive/refs/heads/gh-pages.zip">
                metacubexd
              </SelectItem>
            </Select>
          </div>
        </SettingItem>
      )}
      <SettingItem title="允许私有网络访问" divider>
        <Switch
          size="sm"
          isSelected={allowPrivateNetwork}
          onValueChange={(v) => {
            onChangeNeedRestart({
              'external-controller-cors': {
                ...externalControllerCors,
                'allow-private-network': v
              }
            })
          }}
        />
      </SettingItem>
      <SettingItem title="允许的来源" divider={false}>
        {allowOriginsInput.join(',') != initialAllowOrigins.join(',') && (
          <Button
            size="sm"
            color="primary"
            onPress={() => {
              const finalOrigins = allowOriginsInput.length == 0 ? ['*'] : allowOriginsInput
              onChangeNeedRestart({
                'external-controller-cors': {
                  ...externalControllerCors,
                  'allow-origins': finalOrigins
                }
              })
            }}
          >
            确认
          </Button>
        )}
        <EditableList
          items={allowOriginsInput}
          onChange={(items) => setAllowOriginsInput(items as string[])}
          divider={false}
          inputClassNames={inputClassNames}
        />
      </SettingItem>
    </SettingCard>
  )
}

export default ControllerSetting
