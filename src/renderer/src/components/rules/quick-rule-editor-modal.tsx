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
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useGroups } from '@renderer/hooks/use-groups'
import { addQuickRule, updateQuickRule } from '@renderer/utils/quick-rules-ipc'
import { secondaryInputClassNames } from '@renderer/components/settings/advanced-settings'
import {
  createSecondaryModalClassNames,
  getMainPaneModalContentStyle,
  SECONDARY_MODAL_HEADER_CLASSNAME
} from '@renderer/utils/modal-styles'
import { useI18n, type TranslationKey } from '@renderer/i18n'

interface Props {
  profileId: string
  rule?: QuickRule | null
  onClose: () => void
  onSaved: () => Promise<void> | void
}

const RULE_TYPES = [
  { key: 'DOMAIN', label: 'DOMAIN', descKey: 'rules.desc.domain' },
  { key: 'DOMAIN-SUFFIX', label: 'DOMAIN-SUFFIX', descKey: 'rules.desc.domainSuffix' },
  { key: 'DOMAIN-KEYWORD', label: 'DOMAIN-KEYWORD', descKey: 'rules.desc.domainKeyword' },
  { key: 'DOMAIN-WILDCARD', label: 'DOMAIN-WILDCARD', descKey: 'rules.desc.domainWildcard' },
  { key: 'DOMAIN-REGEX', label: 'DOMAIN-REGEX', descKey: 'rules.desc.domainRegex' },
  { key: 'IP-CIDR', label: 'IP-CIDR', descKey: 'rules.desc.ipCidr4' },
  { key: 'IP-CIDR6', label: 'IP-CIDR6', descKey: 'rules.desc.ipCidr6' },
  { key: 'IP-SUFFIX', label: 'IP-SUFFIX', descKey: 'rules.desc.ipSuffix' },
  { key: 'IP-ASN', label: 'IP-ASN', descKey: 'rules.desc.ipAsn' },
  { key: 'GEOIP', label: 'GEOIP', descKey: 'rules.desc.geoip' },
  { key: 'SRC-GEOIP', label: 'SRC-GEOIP', descKey: 'rules.desc.srcGeoip' },
  { key: 'PROCESS-NAME', label: 'PROCESS-NAME', descKey: 'rules.desc.processName' },
  { key: 'PROCESS-PATH', label: 'PROCESS-PATH', descKey: 'rules.desc.processPath' },
  {
    key: 'PROCESS-NAME-REGEX',
    label: 'PROCESS-NAME-REGEX',
    descKey: 'rules.desc.processNameRegex'
  },
  {
    key: 'PROCESS-PATH-REGEX',
    label: 'PROCESS-PATH-REGEX',
    descKey: 'rules.desc.processPathRegex'
  },
  { key: 'DST-PORT', label: 'DST-PORT', descKey: 'rules.desc.dstPort' },
  { key: 'SRC-PORT', label: 'SRC-PORT', descKey: 'rules.desc.srcPort' },
  { key: 'NETWORK', label: 'NETWORK', descKey: 'rules.desc.network' },
  { key: 'GEOSITE', label: 'GEOSITE', descKey: 'rules.desc.geosite' }
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
  const { t } = useI18n()
  const { groups = [] } = useGroups()
  const { appConfig: { collapseSidebar = false, siderWidth = 250 } = {} } = useAppConfig()
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
      alert(t(isEditing ? 'rules.updateFailed' : 'rules.createFailed', { error: String(error) }))
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
      size="lg"
      backdrop="blur"
      scrollBehavior="inside"
      hideCloseButton
      classNames={createSecondaryModalClassNames()}
    >
      <ModalContent
        style={getMainPaneModalContentStyle({ collapseSidebar, siderWidth, maxWidthPx: 640 })}
      >
        <>
          <ModalHeader className={SECONDARY_MODAL_HEADER_CLASSNAME}>
            <div className="flex flex-col gap-0.5">
              <span>{isEditing ? t('rules.localEditTitle') : t('rules.localCreateTitle')}</span>
              <span className="text-xs font-normal text-foreground-500">
                {t('rules.localHelp')}
              </span>
            </div>
            <SecondaryModalCloseButton onPress={onClose} />
          </ModalHeader>

          <ModalBody className="px-6 py-4">
            <div className="flex flex-col gap-3">
              <Select
                label={`${t('rules.ruleType')} - ${t((RULE_TYPES.find((item) => item.key === ruleType)?.descKey || 'rules.desc.domain') as TranslationKey)}`}
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
                    {item.label} - {t(item.descKey as TranslationKey)}
                  </SelectItem>
                ))}
              </Select>

              <Input
                label={t('rules.ruleValue')}
                value={ruleValue}
                onValueChange={setRuleValue}
                size="md"
                placeholder={t('rules.ruleValuePlaceholder')}
                classNames={secondaryInputClassNames}
              />

              <Autocomplete
                label={t('rules.targetProxy')}
                inputValue={proxyTarget}
                onInputChange={setProxyTarget}
                onSelectionChange={(key) => {
                  if (key) {
                    setProxyTarget(key as string)
                  }
                }}
                size="md"
                allowsCustomValue
                placeholder={t('rules.targetProxyPlaceholder')}
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
                    <span className="text-xs text-foreground-500">{t('rules.noResolveHelp')}</span>
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
                  <div className="mb-2 text-xs font-medium text-foreground-500">
                    {t('rules.preview')}
                  </div>
                  <code className="break-all font-mono text-sm text-primary">{ruleString}</code>
                </div>
              )}
            </div>
          </ModalBody>

          <ModalFooter className="py-2 px-4">
            <Button
              variant="shadow"
              onPress={onClose}
              isDisabled={isSubmitting}
              className="font-medium px-8"
            >
              {t('rules.exit')}
            </Button>
            <Button
              color="primary"
              variant="shadow"
              onPress={handleSubmit}
              isDisabled={!ruleValue.trim() || !proxyTarget.trim()}
              isLoading={isSubmitting}
              className="font-medium px-8"
            >
              {isEditing ? t('rules.saveChanges') : t('rules.createRule')}
            </Button>
          </ModalFooter>
        </>
      </ModalContent>
    </Modal>
  )
}

export default QuickRuleEditorModal
