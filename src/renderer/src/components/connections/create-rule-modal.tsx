import {
  Modal,
  ModalContent,
  ModalBody,
  Button,
  Select,
  SelectItem,
  Input,
  Chip,
  Autocomplete,
  AutocompleteItem,
  Divider,
  Tooltip
} from '@heroui/react'
import React, { useMemo, useState, useCallback, useEffect } from 'react'
import { useGroups } from '@renderer/hooks/use-groups'
import { getCurrentProfileItem } from '@renderer/utils/profile-ipc'
import {
  addQuickRule,
  getQuickRules,
  removeQuickRule,
  updateQuickRule
} from '@renderer/utils/quick-rules-ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { getMainPaneModalContentStyle } from '@renderer/utils/modal-styles'
import { useI18n, type TranslationKey } from '@renderer/i18n'
interface Props {
  connection: ControllerConnectionDetail
  onClose: () => void
}

interface RuleDraft {
  type: string
  value: string
  target: string
  noResolve?: boolean
}

// 将结构化规则还原为字符串
function ruleToString(rule: RuleDraft): string {
  let s = `${rule.type},${rule.value},${rule.target}`
  if (rule.noResolve) s += ',no-resolve'
  return s
}

// mihomo 支持的规则类型
const RULE_TYPES = [
  // 域名类
  { key: 'DOMAIN', label: 'DOMAIN', descKey: 'rules.desc.domain', category: 'domain' },
  {
    key: 'DOMAIN-SUFFIX',
    label: 'DOMAIN-SUFFIX',
    descKey: 'rules.desc.domainSuffix',
    category: 'domain'
  },
  {
    key: 'DOMAIN-KEYWORD',
    label: 'DOMAIN-KEYWORD',
    descKey: 'rules.desc.domainKeyword',
    category: 'domain'
  },
  {
    key: 'DOMAIN-WILDCARD',
    label: 'DOMAIN-WILDCARD',
    descKey: 'rules.desc.domainWildcard',
    category: 'domain'
  },
  {
    key: 'DOMAIN-REGEX',
    label: 'DOMAIN-REGEX',
    descKey: 'rules.desc.domainRegex',
    category: 'domain'
  },
  // IP 类
  { key: 'IP-CIDR', label: 'IP-CIDR', descKey: 'rules.desc.ipCidr4', category: 'ip' },
  { key: 'IP-CIDR6', label: 'IP-CIDR6', descKey: 'rules.desc.ipCidr6', category: 'ip' },
  { key: 'IP-SUFFIX', label: 'IP-SUFFIX', descKey: 'rules.desc.ipSuffix', category: 'ip' },
  { key: 'IP-ASN', label: 'IP-ASN', descKey: 'rules.desc.ipAsn', category: 'ip' },
  { key: 'GEOIP', label: 'GEOIP', descKey: 'rules.desc.geoip', category: 'ip' },
  { key: 'SRC-GEOIP', label: 'SRC-GEOIP', descKey: 'rules.desc.srcGeoip', category: 'ip' },
  // 进程类
  {
    key: 'PROCESS-NAME',
    label: 'PROCESS-NAME',
    descKey: 'rules.desc.processName',
    category: 'process'
  },
  {
    key: 'PROCESS-PATH',
    label: 'PROCESS-PATH',
    descKey: 'rules.desc.processPath',
    category: 'process'
  },
  {
    key: 'PROCESS-NAME-REGEX',
    label: 'PROCESS-NAME-REGEX',
    descKey: 'rules.desc.processNameRegex',
    category: 'process'
  },
  {
    key: 'PROCESS-PATH-REGEX',
    label: 'PROCESS-PATH-REGEX',
    descKey: 'rules.desc.processPathRegex',
    category: 'process'
  },
  // 端口/网络类
  { key: 'DST-PORT', label: 'DST-PORT', descKey: 'rules.desc.dstPort', category: 'port' },
  { key: 'SRC-PORT', label: 'SRC-PORT', descKey: 'rules.desc.srcPort', category: 'port' },
  { key: 'NETWORK', label: 'NETWORK', descKey: 'rules.desc.network', category: 'port' },
  // GEO 类
  { key: 'GEOSITE', label: 'GEOSITE', descKey: 'rules.desc.geosite', category: 'geo' }
] as const

// 常用规则快捷选项
const COMMON_PROXIES = ['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS']

const CreateRuleModal: React.FC<Props> = ({ connection, onClose }) => {
  const { t } = useI18n()
  const { groups = [] } = useGroups()
  const { appConfig: { collapseSidebar = false, siderWidth = 250 } = {} } = useAppConfig()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 已有的快速规则列表
  const [existingRules, setExistingRules] = useState<QuickRule[]>([])
  const [profileId, setProfileId] = useState('default')
  // 正在编辑的规则索引（-1 表示新建模式）
  const [editingIndex, setEditingIndex] = useState(-1)

  // 从连接信息中提取可用数据
  const host = connection.metadata.host || connection.metadata.sniffHost || ''
  const destIP = connection.metadata.destinationIP || ''
  const process = connection.metadata.process || ''
  const processPath = connection.metadata.processPath || ''
  const destPort = connection.metadata.destinationPort || ''
  const srcPort = connection.metadata.sourcePort || ''
  const network = connection.metadata.network || ''

  // 智能推荐默认规则类型
  const defaultRuleType = useMemo(() => {
    if (host) return 'DOMAIN'
    if (destIP) return 'IP-CIDR'
    if (process) return 'PROCESS-NAME'
    return 'DOMAIN'
  }, [host, destIP, process])

  const [ruleType, setRuleType] = useState(defaultRuleType)
  const [ruleValue, setRuleValue] = useState(() => {
    if (host) return host
    if (destIP) return destIP.includes(':') ? `${destIP}/128` : `${destIP}/32`
    if (process) return process
    return ''
  })
  const [proxyTarget, setProxyTarget] = useState('DIRECT')
  const [noResolve, setNoResolve] = useState(false)

  // 加载已有的快速规则
  useEffect(() => {
    const loadExistingRules = async (): Promise<void> => {
      try {
        const currentProfile = await getCurrentProfileItem()
        const currentProfileId = currentProfile.id || 'default'
        setProfileId(currentProfileId)
        const quickRules = await getQuickRules(currentProfileId)
        setExistingRules(quickRules.rules)
      } catch {
        // 忽略加载失败
      }
    }
    loadExistingRules()
  }, [])

  // 当规则类型变化时，自动填充合适的值
  const handleRuleTypeChange = useCallback(
    (selectedKey: string) => {
      if (!selectedKey) return
      setRuleType(selectedKey)

      switch (selectedKey) {
        case 'DOMAIN':
          setRuleValue(host)
          setNoResolve(false)
          break
        case 'DOMAIN-SUFFIX':
          if (host) {
            const parts = host.split('.')
            setRuleValue(parts.length > 2 ? parts.slice(-2).join('.') : host)
          }
          setNoResolve(false)
          break
        case 'DOMAIN-KEYWORD':
          if (host) {
            const parts = host.split('.')
            setRuleValue(parts.length > 2 ? parts[parts.length - 2] : parts[0])
          }
          setNoResolve(false)
          break
        case 'DOMAIN-WILDCARD':
          setRuleValue(host ? `*.${host.split('.').slice(-2).join('.')}` : '')
          setNoResolve(false)
          break
        case 'DOMAIN-REGEX':
          setRuleValue(host ? host.replace(/\./g, '\\.') : '')
          setNoResolve(false)
          break
        case 'IP-CIDR':
          setRuleValue(destIP.includes(':') ? '' : destIP ? `${destIP}/32` : '')
          setNoResolve(true)
          break
        case 'IP-CIDR6':
          setRuleValue(destIP.includes(':') ? `${destIP}/128` : '')
          setNoResolve(true)
          break
        case 'IP-SUFFIX':
          setRuleValue(destIP || '')
          setNoResolve(true)
          break
        case 'IP-ASN':
          setRuleValue('')
          setNoResolve(true)
          break
        case 'GEOIP':
        case 'SRC-GEOIP':
          setRuleValue('CN')
          setNoResolve(true)
          break
        case 'PROCESS-NAME':
          setRuleValue(process)
          setNoResolve(false)
          break
        case 'PROCESS-PATH':
          setRuleValue(processPath)
          setNoResolve(false)
          break
        case 'PROCESS-NAME-REGEX':
          setRuleValue(process ? process.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '')
          setNoResolve(false)
          break
        case 'PROCESS-PATH-REGEX':
          setRuleValue(processPath ? processPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '')
          setNoResolve(false)
          break
        case 'DST-PORT':
          setRuleValue(destPort)
          setNoResolve(false)
          break
        case 'SRC-PORT':
          setRuleValue(srcPort)
          setNoResolve(false)
          break
        case 'NETWORK':
          setRuleValue(network)
          setNoResolve(false)
          break
        case 'GEOSITE':
          setRuleValue('')
          setNoResolve(false)
          break
        default:
          setRuleValue('')
          setNoResolve(false)
      }
    },
    [host, destIP, process, processPath, destPort, srcPort, network]
  )

  // 判断当前规则类型是否支持 no-resolve 参数
  const supportsNoResolve = useMemo(() => {
    return ['IP-CIDR', 'IP-CIDR6', 'IP-SUFFIX', 'IP-ASN', 'GEOIP', 'SRC-GEOIP'].includes(ruleType)
  }, [ruleType])

  // 构建规则预览字符串
  const ruleString = useMemo(() => {
    if (!ruleValue || !proxyTarget) return ''
    let rule = `${ruleType},${ruleValue},${proxyTarget}`
    if (supportsNoResolve && noResolve) {
      rule += ',no-resolve'
    }
    return rule
  }, [ruleType, ruleValue, proxyTarget, supportsNoResolve, noResolve])

  // 可用的代理目标列表
  const proxyOptions = useMemo(() => {
    const options = [...COMMON_PROXIES]
    groups.forEach((g) => {
      if (!options.includes(g.name)) {
        options.push(g.name)
      }
    })
    return options
  }, [groups])

  // 添加或更新规则
  const handleSubmit = useCallback(async () => {
    if (!ruleValue || !proxyTarget) return

    setIsSubmitting(true)
    try {
      const newRule: QuickRuleInput = {
        type: ruleType,
        value: ruleValue,
        target: proxyTarget,
        noResolve: supportsNoResolve && noResolve,
        source: 'connection'
      }

      let updatedRules: QuickRule[]
      if (editingIndex >= 0) {
        // 编辑模式：替换指定索引的规则
        updatedRules = [...existingRules]
        const editingRule = updatedRules[editingIndex]
        if (!editingRule) return
        await updateQuickRule(profileId, editingRule.id, newRule)
        updatedRules[editingIndex] = {
          ...editingRule,
          ...newRule,
          updatedAt: Date.now()
        }
      } else {
        // 新建模式：追加到列表开头（前置，优先级最高）
        const createdRule = await addQuickRule(profileId, newRule)
        updatedRules = [createdRule, ...existingRules]
      }

      setExistingRules(updatedRules)
      setEditingIndex(-1)

      // 如果是新建模式，重置表单但不关闭弹窗
      if (editingIndex < 0) {
        // 保持弹窗打开，让用户看到新添加的规则
      }
      onClose()
    } catch (e) {
      alert(
        t('connections.ruleSaveFailed', {
          action: editingIndex >= 0 ? t('common.update') : t('common.create'),
          error: String(e)
        })
      )
    } finally {
      setIsSubmitting(false)
    }
  }, [
    ruleValue,
    proxyTarget,
    ruleType,
    ruleString,
    supportsNoResolve,
    noResolve,
    editingIndex,
    existingRules,
    profileId,
    onClose,
    t
  ])

  // 删除一条规则
  const handleDeleteRule = useCallback(
    async (index: number) => {
      setIsSubmitting(true)
      try {
        const rule = existingRules[index]
        if (!rule) return
        await removeQuickRule(profileId, rule.id)
        const updatedRules = existingRules.filter((_, i) => i !== index)
        setExistingRules(updatedRules)
        // 如果正在编辑被删除的规则，退出编辑模式
        if (editingIndex === index) {
          setEditingIndex(-1)
        } else if (editingIndex > index) {
          setEditingIndex(editingIndex - 1)
        }
      } catch (e) {
        alert(t('connections.deleteRuleFailed', { error: String(e) }))
      } finally {
        setIsSubmitting(false)
      }
    },
    [existingRules, editingIndex, profileId, t]
  )

  // 点击编辑规则：将规则内容填充到表单
  const handleEditRule = useCallback((rule: QuickRule, index: number) => {
    setRuleType(rule.type)
    setRuleValue(rule.value)
    setProxyTarget(rule.target)
    setNoResolve(rule.noResolve ?? false)
    setEditingIndex(index)
  }, [])

  // 取消编辑，恢复为新建模式
  const handleCancelEdit = useCallback(() => {
    setEditingIndex(-1)
    // 恢复默认值
    setRuleType(defaultRuleType)
    setRuleValue(
      host || (destIP ? (destIP.includes(':') ? `${destIP}/128` : `${destIP}/32`) : process || '')
    )
    setProxyTarget('DIRECT')
    setNoResolve(false)
  }, [defaultRuleType, host, destIP, process])

  const renderContent = () => (
    <>
      <div className="flex flex-col gap-0.5 mb-2">
        <span className="text-large font-medium">
          {editingIndex >= 0 ? t('page.rules.edit') : t('page.rules.create')}
        </span>
        <span className="text-small text-foreground-400 font-normal">
          {t('connections.createRuleHelp')}
        </span>
      </div>

      {/* 连接信息摘要 */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {host && (
          <Chip size="sm" variant="flat" color="primary">
            {t('connections.summary.domain', { value: host })}
          </Chip>
        )}
        {destIP && (
          <Chip size="sm" variant="flat" color="secondary">
            IP: {destIP}
          </Chip>
        )}
        {process && (
          <Chip size="sm" variant="flat" color="warning">
            {t('connections.summary.process', { value: process })}
          </Chip>
        )}
        {connection.rule && (
          <Chip size="sm" variant="flat" color="danger">
            {t('connections.summary.currentRule', {
              value: `${connection.rule} ${connection.rulePayload}`
            })}
          </Chip>
        )}
        {connection.chains?.[0] && (
          <Chip
            size="sm"
            variant="flat"
            style={{
              backgroundColor: 'rgba(5, 150, 105, 0.15)',
              color: 'rgb(5, 150, 105)'
            }}
          >
            {t('connections.summary.currentProxy', { value: connection.chains[0] })}
          </Chip>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {/* 规则类型选择 */}
        <Select
          label={t('connections.ruleTypeLabel', {
            description: t(
              (RULE_TYPES.find((r) => r.key === ruleType)?.descKey ||
                'rules.desc.domain') as TranslationKey
            )
          })}
          selectedKeys={new Set([ruleType])}
          onSelectionChange={(v) => {
            const selectedKey = v.currentKey as string
            if (selectedKey) handleRuleTypeChange(selectedKey)
          }}
          disallowEmptySelection
          size="md"
        >
          {RULE_TYPES.map((r) => (
            <SelectItem key={r.key} textValue={r.label}>
              {r.label} - {t(r.descKey)}
            </SelectItem>
          ))}
        </Select>

        {/* 规则值输入 */}
        <Input
          label={t('rules.ruleValue')}
          value={ruleValue}
          onValueChange={setRuleValue}
          size="md"
          placeholder={t('rules.ruleValuePlaceholder')}
        />

        {/* 目标代理/策略组选择 */}
        <Autocomplete
          label={t('rules.targetProxy')}
          defaultInputValue={proxyTarget}
          onInputChange={setProxyTarget}
          onSelectionChange={(key) => {
            if (key) setProxyTarget(key as string)
          }}
          size="md"
          allowsCustomValue
          placeholder={t('rules.targetProxyPlaceholder')}
        >
          {proxyOptions.map((option) => (
            <AutocompleteItem key={option}>{option}</AutocompleteItem>
          ))}
        </Autocomplete>

        {/* no-resolve 选项 */}
        {supportsNoResolve && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="no-resolve"
              checked={noResolve}
              onChange={(e) => setNoResolve(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="no-resolve" className="text-sm text-foreground-500">
              {t('connections.noResolveOption')}
            </label>
          </div>
        )}

        {/* 规则预览 */}
        {ruleString && (
          <div className="p-3 rounded-lg bg-default-100">
            <div className="text-xs text-foreground-400 mb-1">{t('rules.preview')}</div>
            <code className="text-sm font-mono text-primary break-all">{ruleString}</code>
          </div>
        )}

        {/* 已有快速规则列表 */}
        <div>
          <Divider />
          <div className="text-sm font-semibold mt-2 mb-2 text-warning">
            {t('connections.existingQuickRules', { count: existingRules.length })}
          </div>

          {existingRules.length > 0 ? (
            <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto">
              {existingRules.map((rule, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-2 rounded-lg text-xs ${
                    editingIndex === index
                      ? 'bg-primary-50 border border-primary-200'
                      : 'bg-default-100 hover:bg-default-200'
                  } transition-colors`}
                >
                  <code className="font-mono text-foreground-700 break-all flex-1 mr-2">
                    {ruleToString(rule)}
                  </code>
                  <div className="flex gap-1 flex-shrink-0">
                    <Tooltip content={t('common.edit')}>
                      <Button
                        size="sm"
                        variant="light"
                        isIconOnly
                        className="min-w-6 w-6 h-6"
                        onPress={() => handleEditRule(rule, index)}
                        isDisabled={isSubmitting}
                      >
                        ✏️
                      </Button>
                    </Tooltip>
                    <Tooltip content={t('common.delete')}>
                      <Button
                        size="sm"
                        variant="light"
                        color="danger"
                        isIconOnly
                        className="min-w-6 w-6 h-6"
                        onPress={() => handleDeleteRule(index)}
                        isDisabled={isSubmitting}
                      >
                        🗑️
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-foreground-400 text-center py-1 bg-default-50 rounded-lg border border-dashed border-default-200">
              {t('connections.noQuickRules')}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-2">
        {editingIndex >= 0 && (
          <Button variant="flat" onPress={handleCancelEdit} isDisabled={isSubmitting}>
            {t('connections.cancelEdit')}
          </Button>
        )}
        <Button variant="light" onPress={onClose}>
          {t('common.close')}
        </Button>
        <Button
          color="primary"
          onPress={handleSubmit}
          isDisabled={!ruleValue || !proxyTarget}
          isLoading={isSubmitting}
        >
          {editingIndex >= 0 ? t('rules.saveChanges') : t('rules.createRule')}
        </Button>
      </div>
    </>
  )

  return (
    <Modal isOpen={true} onClose={onClose} size="lg" scrollBehavior="inside" placement="center">
      <ModalContent
        className="mx-4 my-4"
        style={getMainPaneModalContentStyle({ collapseSidebar, siderWidth, maxWidthPx: 720 })}
      >
        <ModalBody className="py-4">{renderContent()}</ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default CreateRuleModal
