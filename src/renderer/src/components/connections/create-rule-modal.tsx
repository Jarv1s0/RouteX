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
import { restartCore } from '@renderer/utils/mihomo-ipc'
import { addOverrideItem, getOverrideConfig, getOverride, setOverride } from '@renderer/utils/override-ipc'
import { getCurrentProfileItem, updateProfileItem } from '@renderer/utils/profile-ipc'
interface Props {
  connection: ControllerConnectionDetail
  onClose: () => void
}

// 快速规则覆写的固定 ID
const QUICK_RULES_ID = 'quick-rules'

// 解析规则字符串为结构化对象
interface ParsedRule {
  type: string
  value: string
  proxy: string
  noResolve: boolean
  raw: string
}

// 解析一条规则字符串
function parseRuleString(raw: string): ParsedRule | null {
  const parts = raw.split(',')
  if (parts.length < 3) return null
  const type = parts[0]
  const value = parts[1]
  const proxy = parts[2]
  const noResolve = parts.length > 3 && parts[3] === 'no-resolve'
  return { type, value, proxy, noResolve, raw }
}

// 将结构化规则还原为字符串
function ruleToString(rule: ParsedRule): string {
  let s = `${rule.type},${rule.value},${rule.proxy}`
  if (rule.noResolve) s += ',no-resolve'
  return s
}

// 生成覆写 YAML 内容
function generateYaml(rules: ParsedRule[]): string {
  if (rules.length === 0) return '"+rules": []\n'
  const lines = rules.map((r) => `  - ${ruleToString(r)}`)
  return `# 由连接页面快速创建的路由规则\n"+rules":\n${lines.join('\n')}\n`
}

// mihomo 支持的规则类型
const RULE_TYPES = [
  // 域名类
  { key: 'DOMAIN', label: 'DOMAIN', desc: '完整域名匹配', category: 'domain' },
  { key: 'DOMAIN-SUFFIX', label: 'DOMAIN-SUFFIX', desc: '域名后缀匹配', category: 'domain' },
  { key: 'DOMAIN-KEYWORD', label: 'DOMAIN-KEYWORD', desc: '域名关键字匹配', category: 'domain' },
  {
    key: 'DOMAIN-WILDCARD',
    label: 'DOMAIN-WILDCARD',
    desc: '域名通配符匹配',
    category: 'domain'
  },
  { key: 'DOMAIN-REGEX', label: 'DOMAIN-REGEX', desc: '域名正则匹配', category: 'domain' },
  // IP 类
  { key: 'IP-CIDR', label: 'IP-CIDR', desc: 'IPv4 CIDR 匹配', category: 'ip' },
  { key: 'IP-CIDR6', label: 'IP-CIDR6', desc: 'IPv6 CIDR 匹配', category: 'ip' },
  { key: 'IP-SUFFIX', label: 'IP-SUFFIX', desc: 'IP 后缀匹配', category: 'ip' },
  { key: 'IP-ASN', label: 'IP-ASN', desc: 'IP ASN 匹配', category: 'ip' },
  { key: 'GEOIP', label: 'GEOIP', desc: '目标 IP 地理位置', category: 'ip' },
  { key: 'SRC-GEOIP', label: 'SRC-GEOIP', desc: '源 IP 地理位置', category: 'ip' },
  // 进程类
  { key: 'PROCESS-NAME', label: 'PROCESS-NAME', desc: '进程名匹配', category: 'process' },
  { key: 'PROCESS-PATH', label: 'PROCESS-PATH', desc: '进程路径匹配', category: 'process' },
  {
    key: 'PROCESS-NAME-REGEX',
    label: 'PROCESS-NAME-REGEX',
    desc: '进程名正则匹配',
    category: 'process'
  },
  {
    key: 'PROCESS-PATH-REGEX',
    label: 'PROCESS-PATH-REGEX',
    desc: '进程路径正则匹配',
    category: 'process'
  },
  // 端口/网络类
  { key: 'DST-PORT', label: 'DST-PORT', desc: '目标端口匹配', category: 'port' },
  { key: 'SRC-PORT', label: 'SRC-PORT', desc: '源端口匹配', category: 'port' },
  { key: 'NETWORK', label: 'NETWORK', desc: '网络协议（tcp/udp）', category: 'port' },
  // GEO 类
  { key: 'GEOSITE', label: 'GEOSITE', desc: 'GeoSite 域名集合', category: 'geo' }
] as const

// 常用规则快捷选项
const COMMON_PROXIES = ['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS']

const CreateRuleModal: React.FC<Props> = ({ connection, onClose }) => {
  const { groups = [] } = useGroups()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 已有的快速规则列表
  const [existingRules, setExistingRules] = useState<ParsedRule[]>([])
  const [quickRulesExists, setQuickRulesExists] = useState(false)
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
        const config = await getOverrideConfig()
        const quickRulesItem = config.items?.find((item) => item.id === QUICK_RULES_ID)
        if (quickRulesItem) {
          setQuickRulesExists(true)
          const content = await getOverride(QUICK_RULES_ID, 'yaml')
          if (content) {
            // 从 YAML 内容中提取规则行
            const lines = content.split('\n')
            const rules: ParsedRule[] = []
            for (const line of lines) {
              const trimmed = line.trim()
              if (trimmed.startsWith('- ')) {
                const ruleStr = trimmed.slice(2).trim()
                const parsed = parseRuleString(ruleStr)
                if (parsed) rules.push(parsed)
              }
            }
            setExistingRules(rules)
          }
        }
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
    return ['IP-CIDR', 'IP-CIDR6', 'IP-SUFFIX', 'IP-ASN', 'GEOIP', 'SRC-GEOIP'].includes(
      ruleType
    )
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

  // 保存规则到覆写文件并重启
  const saveRulesAndRestart = useCallback(
    async (rules: ParsedRule[]) => {
      const yamlContent = generateYaml(rules)

      if (!quickRulesExists) {
        // 首次创建：新建覆写文件
        await addOverrideItem({
          id: QUICK_RULES_ID,
          type: 'local',
          ext: 'yaml',
          name: '快速规则',
          file: yamlContent,
          global: false
        })
        setQuickRulesExists(true)
      } else {
        // 更新已有覆写文件
        await setOverride(QUICK_RULES_ID, 'yaml', yamlContent)
      }

      // 确保绑定到当前 profile 的 override 列表（无论是新建还是更新）
      const currentProfile = await getCurrentProfileItem()
      const currentOverride = currentProfile.override || []
      if (!currentOverride.includes(QUICK_RULES_ID)) {
        currentOverride.push(QUICK_RULES_ID)
        await updateProfileItem({ ...currentProfile, override: currentOverride })
      }

      // 重启核心使规则生效
      await restartCore()
    },
    [quickRulesExists]
  )

  // 添加或更新规则
  const handleSubmit = useCallback(async () => {
    if (!ruleValue || !proxyTarget) return

    setIsSubmitting(true)
    try {
      const newRule: ParsedRule = {
        type: ruleType,
        value: ruleValue,
        proxy: proxyTarget,
        noResolve: supportsNoResolve && noResolve,
        raw: ruleString
      }

      let updatedRules: ParsedRule[]
      if (editingIndex >= 0) {
        // 编辑模式：替换指定索引的规则
        updatedRules = [...existingRules]
        updatedRules[editingIndex] = newRule
      } else {
        // 新建模式：追加到列表开头（前置，优先级最高）
        updatedRules = [newRule, ...existingRules]
      }

      await saveRulesAndRestart(updatedRules)
      setExistingRules(updatedRules)
      setEditingIndex(-1)

      // 如果是新建模式，重置表单但不关闭弹窗
      if (editingIndex < 0) {
        // 保持弹窗打开，让用户看到新添加的规则
      }
      onClose()
    } catch (e) {
      alert(`${editingIndex >= 0 ? '修改' : '创建'}规则失败: ${e}`)
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
    saveRulesAndRestart,
    onClose
  ])

  // 删除一条规则
  const handleDeleteRule = useCallback(
    async (index: number) => {
      setIsSubmitting(true)
      try {
        const updatedRules = existingRules.filter((_, i) => i !== index)
        await saveRulesAndRestart(updatedRules)
        setExistingRules(updatedRules)
        // 如果正在编辑被删除的规则，退出编辑模式
        if (editingIndex === index) {
          setEditingIndex(-1)
        } else if (editingIndex > index) {
          setEditingIndex(editingIndex - 1)
        }
      } catch (e) {
        alert(`删除规则失败: ${e}`)
      } finally {
        setIsSubmitting(false)
      }
    },
    [existingRules, editingIndex, saveRulesAndRestart]
  )

  // 点击编辑规则：将规则内容填充到表单
  const handleEditRule = useCallback((rule: ParsedRule, index: number) => {
    setRuleType(rule.type)
    setRuleValue(rule.value)
    setProxyTarget(rule.proxy)
    setNoResolve(rule.noResolve)
    setEditingIndex(index)
  }, [])

  // 取消编辑，恢复为新建模式
  const handleCancelEdit = useCallback(() => {
    setEditingIndex(-1)
    // 恢复默认值
    setRuleType(defaultRuleType)
    setRuleValue(host || (destIP ? (destIP.includes(':') ? `${destIP}/128` : `${destIP}/32`) : process || ''))
    setProxyTarget('DIRECT')
    setNoResolve(false)
  }, [defaultRuleType, host, destIP, process])
  
  const renderContent = () => (
    <>
             <div className="flex flex-col gap-0.5 mb-2">
              <span className="text-large font-medium">{editingIndex >= 0 ? '编辑规则' : '新建规则'}</span>
              <span className="text-small text-foreground-400 font-normal">
                从连接信息快速创建路由规则
              </span>
            </div>
          
            {/* 连接信息摘要 */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {host && (
                <Chip size="sm" variant="flat" color="primary">
                  域名: {host}
                </Chip>
              )}
              {destIP && (
                <Chip size="sm" variant="flat" color="secondary">
                  IP: {destIP}
                </Chip>
              )}
              {process && (
                <Chip size="sm" variant="flat" color="warning">
                  进程: {process}
                </Chip>
              )}
              {connection.rule && (
                <Chip size="sm" variant="flat" color="danger">
                  当前规则: {connection.rule} {connection.rulePayload}
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
                  当前代理: {connection.chains[0]}
                </Chip>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {/* 规则类型选择 */}
              <Select
                label={`规则类型 - ${RULE_TYPES.find((r) => r.key === ruleType)?.desc || ''}`}
                selectedKeys={new Set([ruleType])}
                onSelectionChange={(v) => {
                  const selectedKey = v.currentKey as string
                  if (selectedKey) handleRuleTypeChange(selectedKey)
                }}
                disallowEmptySelection
                size="md"
              >
                {RULE_TYPES.map((r) => (
                   <SelectItem key={r.key} textValue={r.label}>{r.label} - {r.desc}</SelectItem>
                ))}
              </Select>

              {/* 规则值输入 */}
              <Input
                label="规则值"
                value={ruleValue}
                onValueChange={setRuleValue}
                size="md"
                placeholder="输入规则值"
              />

              {/* 目标代理/策略组选择 */}
              <Autocomplete
                label="目标代理/策略组"
                defaultInputValue={proxyTarget}
                onInputChange={setProxyTarget}
                onSelectionChange={(key) => {
                  if (key) setProxyTarget(key as string)
                }}
                size="md"
                allowsCustomValue
                placeholder="选择或输入代理组名称"
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
                    no-resolve（不解析域名，直接匹配 IP）
                  </label>
                </div>
              )}

              {/* 规则预览 */}
              {ruleString && (
                <div className="p-3 rounded-lg bg-default-100">
                  <div className="text-xs text-foreground-400 mb-1">规则预览</div>
                  <code className="text-sm font-mono text-primary break-all">{ruleString}</code>
                </div>
              )}

              {/* 已有快速规则列表 */}
              <div>
                <Divider />
                <div className="text-sm font-semibold mt-2 mb-2 text-warning">
                  已有快速规则 ({existingRules.length})
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
                          <Tooltip content="编辑">
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
                          <Tooltip content="删除">
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
                    暂无快速规则
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-2">
              {editingIndex >= 0 && (
                <Button variant="flat" onPress={handleCancelEdit} isDisabled={isSubmitting}>
                  取消编辑
                </Button>
              )}
              <Button variant="light" onPress={onClose}>
                关闭
              </Button>
              <Button
                color="primary"
                onPress={handleSubmit}
                isDisabled={!ruleValue || !proxyTarget}
                isLoading={isSubmitting}
              >
                {editingIndex >= 0 ? '保存修改' : '创建规则'}
              </Button>
            </div>
    </>
  )

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      size="lg"
      scrollBehavior="inside"
      placement="center"
    >
      <ModalContent className="mx-4 my-4">
        <ModalBody className="py-4">
          {renderContent()}
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default CreateRuleModal
