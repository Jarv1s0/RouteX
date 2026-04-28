import {
  Autocomplete,
  AutocompleteItem,
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Switch
} from '@heroui/react'
import React, { useCallback, useMemo, useState } from 'react'
import SecondaryModalCloseButton from '@renderer/components/base/secondary-modal-close'
import { useGroups } from '@renderer/hooks/use-groups'
import { addQuickRule, updateQuickRule } from '@renderer/utils/quick-rules-ipc'
import { secondaryInputClassNames } from '@renderer/components/settings/advanced-settings'
import {
  createSecondaryModalClassNames,
  SECONDARY_MODAL_HEADER_CLASSNAME
} from '@renderer/utils/modal-styles'

interface Props {
  profileId: string
  rule?: QuickRule | null
  onClose: () => void
  onSaved: () => Promise<void> | void
}

const RULE_TYPES = [
  { key: 'DOMAIN', label: 'DOMAIN', desc: '完整域名匹配' },
  { key: 'DOMAIN-SUFFIX', label: 'DOMAIN-SUFFIX', desc: '域名后缀匹配' },
  { key: 'DOMAIN-KEYWORD', label: 'DOMAIN-KEYWORD', desc: '域名关键字匹配' },
  { key: 'DOMAIN-WILDCARD', label: 'DOMAIN-WILDCARD', desc: '域名通配符匹配' },
  { key: 'DOMAIN-REGEX', label: 'DOMAIN-REGEX', desc: '域名正则匹配' },
  { key: 'IP-CIDR', label: 'IP-CIDR', desc: 'IPv4 CIDR 匹配' },
  { key: 'IP-CIDR6', label: 'IP-CIDR6', desc: 'IPv6 CIDR 匹配' },
  { key: 'IP-SUFFIX', label: 'IP-SUFFIX', desc: 'IP 后缀匹配' },
  { key: 'IP-ASN', label: 'IP-ASN', desc: 'IP ASN 匹配' },
  { key: 'GEOIP', label: 'GEOIP', desc: '目标 IP 地理位置' },
  { key: 'SRC-GEOIP', label: 'SRC-GEOIP', desc: '源 IP 地理位置' },
  { key: 'PROCESS-NAME', label: 'PROCESS-NAME', desc: '进程名匹配' },
  { key: 'PROCESS-PATH', label: 'PROCESS-PATH', desc: '进程路径匹配' },
  { key: 'PROCESS-NAME-REGEX', label: 'PROCESS-NAME-REGEX', desc: '进程名正则匹配' },
  { key: 'PROCESS-PATH-REGEX', label: 'PROCESS-PATH-REGEX', desc: '进程路径正则匹配' },
  { key: 'DST-PORT', label: 'DST-PORT', desc: '目标端口匹配' },
  { key: 'SRC-PORT', label: 'SRC-PORT', desc: '源端口匹配' },
  { key: 'NETWORK', label: 'NETWORK', desc: '网络协议（tcp/udp）' },
  { key: 'GEOSITE', label: 'GEOSITE', desc: 'GeoSite 域名集合' }
] as const

const COMMON_PROXIES = ['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS']

const supportsNoResolveForRuleType = (ruleType: string): boolean => {
  return ['IP-CIDR', 'IP-CIDR6', 'IP-SUFFIX', 'IP-ASN', 'GEOIP', 'SRC-GEOIP'].includes(ruleType)
}

const getSuggestedValue = (ruleType: string): string => {
  switch (ruleType) {
    case 'GEOIP':
    case 'SRC-GEOIP':
      return 'CN'
    case 'NETWORK':
      return 'tcp'
    default:
      return ''
  }
}

const QuickRuleEditorModal: React.FC<Props> = ({ profileId, rule, onClose, onSaved }) => {
  const { groups = [] } = useGroups()
  const isEditing = Boolean(rule)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ruleType, setRuleType] = useState(rule?.type || 'DOMAIN')
  const [ruleValue, setRuleValue] = useState(rule?.value || '')
  const [proxyTarget, setProxyTarget] = useState(rule?.target || 'DIRECT')
  const [noResolve, setNoResolve] = useState(rule?.noResolve ?? false)

  const supportsNoResolve = useMemo(() => supportsNoResolveForRuleType(ruleType), [ruleType])

  const ruleString = useMemo(() => {
    if (!ruleValue.trim() || !proxyTarget.trim()) return ''
    let value = `${ruleType},${ruleValue.trim()},${proxyTarget.trim()}`
    if (supportsNoResolve && noResolve) {
      value += ',no-resolve'
    }
    return value
  }, [noResolve, proxyTarget, ruleType, ruleValue, supportsNoResolve])

  const proxyOptions = useMemo(() => {
    const options = [...COMMON_PROXIES]
    groups.forEach((group) => {
      if (!options.includes(group.name)) {
        options.push(group.name)
      }
    })
    return options
  }, [groups])

  const handleRuleTypeChange = useCallback((selectedKey: string) => {
    if (!selectedKey) return
    setRuleType(selectedKey)
    setRuleValue(getSuggestedValue(selectedKey))
    setNoResolve(supportsNoResolveForRuleType(selectedKey))
  }, [])

  const handleSubmit = useCallback(async () => {
    const nextValue = ruleValue.trim()
    const nextTarget = proxyTarget.trim()

    if (!nextValue || !nextTarget) return

    setIsSubmitting(true)

    try {
      const payload: QuickRuleInput = {
        type: ruleType,
        value: nextValue,
        target: nextTarget,
        noResolve: supportsNoResolve && noResolve,
        enabled: rule?.enabled ?? true,
        source: rule?.source ?? 'manual'
      }

      if (rule) {
        await updateQuickRule(profileId, rule.id, payload)
      } else {
        await addQuickRule(profileId, payload)
      }

      await onSaved()
      onClose()
    } catch (error) {
      alert(`${isEditing ? '修改' : '创建'}本地规则失败: ${error}`)
    } finally {
      setIsSubmitting(false)
    }
  }, [
    isEditing,
    noResolve,
    onClose,
    onSaved,
    profileId,
    proxyTarget,
    rule,
    ruleType,
    ruleValue,
    supportsNoResolve
  ])

  return (
    <Modal
      isOpen={true}
      onOpenChange={onClose}
      size="xl"
      backdrop="blur"
      scrollBehavior="inside"
      hideCloseButton
      classNames={createSecondaryModalClassNames()}
    >
      <ModalContent>
        <>
          <ModalHeader className={SECONDARY_MODAL_HEADER_CLASSNAME}>
            <div className="flex flex-col gap-0.5">
              <span>{isEditing ? '编辑本地规则' : '新建本地规则'}</span>
              <span className="text-xs font-normal text-foreground-500">
                写入当前配置的本地规则，优先级最高。
              </span>
            </div>
            <SecondaryModalCloseButton onPress={onClose} />
          </ModalHeader>

          <ModalBody className="px-6 py-4">
            <div className="flex flex-col gap-3">
              <Select
                label={`规则类型 - ${RULE_TYPES.find((item) => item.key === ruleType)?.desc || ''}`}
                selectedKeys={new Set([ruleType])}
                onSelectionChange={(value) => {
                  const selectedKey = value.currentKey as string
                  if (selectedKey) {
                    handleRuleTypeChange(selectedKey)
                  }
                }}
                disallowEmptySelection
                size="md"
                classNames={{
                  trigger:
                    'border border-default-200 bg-default-100/50 shadow-sm rounded-2xl data-[hover=true]:bg-default-200/50 min-h-12',
                  value: 'text-default-900'
                }}
              >
                {RULE_TYPES.map((item) => (
                  <SelectItem key={item.key} textValue={item.label}>
                    {item.label} - {item.desc}
                  </SelectItem>
                ))}
              </Select>

              <Input
                label="规则值"
                value={ruleValue}
                onValueChange={setRuleValue}
                size="md"
                placeholder="输入规则值"
                classNames={secondaryInputClassNames}
              />

              <Autocomplete
                label="目标代理/策略组"
                inputValue={proxyTarget}
                onInputChange={setProxyTarget}
                onSelectionChange={(key) => {
                  if (key) {
                    setProxyTarget(key as string)
                  }
                }}
                size="md"
                allowsCustomValue
                placeholder="选择或输入代理组名称"
                variant="bordered"
                classNames={{
                  selectorButton: 'text-default-500',
                  listboxWrapper: 'max-h-64',
                  popoverContent: 'rounded-2xl'
                }}
              >
                {proxyOptions.map((option) => (
                  <AutocompleteItem key={option}>{option}</AutocompleteItem>
                ))}
              </Autocomplete>

              {supportsNoResolve && (
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-default-200/70 bg-content1/60 px-4 py-3 shadow-sm">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground-700">no-resolve</span>
                    <span className="text-xs text-foreground-500">不解析域名，直接匹配 IP。</span>
                  </div>
                  <Switch
                    size="sm"
                    color="primary"
                    isSelected={noResolve}
                    onValueChange={setNoResolve}
                  />
                </div>
              )}

              {ruleString && (
                <div className="rounded-2xl border border-default-200/70 bg-content1/60 p-4 shadow-sm">
                  <div className="mb-2 text-xs font-medium text-foreground-500">规则预览</div>
                  <code className="break-all font-mono text-sm text-primary">{ruleString}</code>
                </div>
              )}
            </div>
          </ModalBody>

          <ModalFooter className="px-4 py-3">
            <Button
              variant="flat"
              onPress={onClose}
              isDisabled={isSubmitting}
              className="px-8 font-medium"
            >
              退出
            </Button>
            <Button
              color="primary"
              variant="shadow"
              onPress={handleSubmit}
              isDisabled={!ruleValue.trim() || !proxyTarget.trim()}
              isLoading={isSubmitting}
              className="px-8 font-medium"
            >
              {isEditing ? '保存修改' : '创建规则'}
            </Button>
          </ModalFooter>
        </>
      </ModalContent>
    </Modal>
  )
}

export default QuickRuleEditorModal
