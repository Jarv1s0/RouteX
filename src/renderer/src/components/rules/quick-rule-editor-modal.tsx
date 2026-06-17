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
  SelectItem
} from '@heroui/react'
import React, { useCallback, useMemo, useState } from 'react'
import SecondaryModalCloseButton from '@renderer/components/base/secondary-modal-close'
import { useMainPaneModalContentStyle } from '@renderer/hooks/use-main-pane-modal-style'
import { useGroups } from '@renderer/hooks/use-groups'
import { addQuickRule, updateQuickRule } from '@renderer/utils/quick-rules-ipc'
import {
  createSecondaryModalClassNames,
  SECONDARY_MODAL_HEADER_CLASSNAME
} from '@renderer/utils/modal-styles'
import { useI18n, type TranslationKey } from '@renderer/i18n'
import { COMMON_RULE_TARGETS } from '@renderer/utils/rule-targets'
import {
  getSuggestedRuleValue,
  RULE_TYPES,
  supportsNoResolveForRuleType
} from '@renderer/utils/rule-types'
import { CARD_STYLES } from '@renderer/utils/card-styles'

import AppSwitch from '@renderer/components/base/app-switch'
interface Props {
  profileId: string
  rule?: QuickRule | null
  initialRule?: Partial<Pick<QuickRuleInput, 'type' | 'value' | 'target' | 'noResolve' | 'source'>>
  suggestRuleValue?: (ruleType: string) => string
  onClose: () => void
  onSaved: () => Promise<void> | void
}

const QuickRuleEditorModal: React.FC<Props> = ({
  profileId,
  rule,
  initialRule,
  suggestRuleValue = getSuggestedRuleValue,
  onClose,
  onSaved
}) => {
  const { t } = useI18n()
  const { groups = [] } = useGroups()
  const modalContentStyle = useMainPaneModalContentStyle(640)
  const isEditing = Boolean(rule)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ruleType, setRuleType] = useState(rule?.type ?? initialRule?.type ?? 'DOMAIN')
  const [ruleValue, setRuleValue] = useState(rule?.value ?? initialRule?.value ?? '')
  const [proxyTarget, setProxyTarget] = useState(rule?.target ?? initialRule?.target ?? 'DIRECT')
  const [noResolve, setNoResolve] = useState(rule?.noResolve ?? initialRule?.noResolve ?? false)

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
    const options = [...COMMON_RULE_TARGETS]
    groups.forEach((group) => {
      if (!options.includes(group.name)) {
        options.push(group.name)
      }
    })
    return options
  }, [groups])

  const filterProxyOptions = useCallback(
    (textValue: string, inputValue: string) => {
      const normalizedInput = inputValue.trim().toLowerCase()
      if (!normalizedInput) return true

      const isExactOption = proxyOptions.some((option) => option.toLowerCase() === normalizedInput)
      if (isExactOption) return true

      return textValue.toLowerCase().includes(normalizedInput)
    },
    [proxyOptions]
  )

  const selectedProxyTargetKey = useMemo(
    () => (proxyOptions.includes(proxyTarget) ? proxyTarget : null),
    [proxyOptions, proxyTarget]
  )

  const handleRuleTypeChange = useCallback(
    (selectedKey: string) => {
      if (!selectedKey) return
      setRuleType(selectedKey)
      setRuleValue(suggestRuleValue(selectedKey))
      setNoResolve(supportsNoResolveForRuleType(selectedKey))
    },
    [suggestRuleValue]
  )

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
        source: rule?.source ?? initialRule?.source ?? 'manual'
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
    supportsNoResolve,
    initialRule?.source
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
      <ModalContent style={modalContentStyle}>
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
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground-800">
                  {t('rules.ruleType')} -{' '}
                  {t(
                    (RULE_TYPES.find((item) => item.key === ruleType)?.descKey ||
                      'rules.desc.domain') as TranslationKey
                  )}
                </label>
                <Select
                  selectedKeys={new Set([ruleType])}
                  onSelectionChange={(value) => {
                    const selectedKey = value.currentKey as string
                    if (selectedKey) {
                      handleRuleTypeChange(selectedKey)
                    }
                  }}
                  disallowEmptySelection
                  size="md"
                  aria-label={t('rules.ruleType')}
                  classNames={CARD_STYLES.GLASS_SELECT}
                >
                  {RULE_TYPES.map((item) => (
                    <SelectItem key={item.key} textValue={item.label}>
                      {item.label} - {t(item.descKey as TranslationKey)}
                    </SelectItem>
                  ))}
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground-800">
                  {t('rules.ruleValue')}
                </label>
                <Input
                  value={ruleValue}
                  onValueChange={setRuleValue}
                  size="md"
                  aria-label={t('rules.ruleValue')}
                  placeholder={t('rules.ruleValuePlaceholder')}
                  classNames={CARD_STYLES.GLASS_INPUT}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground-800">
                  {t('rules.targetProxy')}
                </label>
                <Autocomplete
                  inputValue={proxyTarget}
                  selectedKey={selectedProxyTargetKey}
                  onInputChange={setProxyTarget}
                  onSelectionChange={(key) => {
                    if (key) {
                      setProxyTarget(key as string)
                    }
                  }}
                  size="md"
                  allowsCustomValue
                  defaultFilter={filterProxyOptions}
                  aria-label={t('rules.targetProxy')}
                  placeholder={t('rules.targetProxyPlaceholder')}
                  inputProps={{
                    classNames: CARD_STYLES.GLASS_INPUT
                  }}
                  classNames={{
                    selectorButton: 'text-default-500',
                    listboxWrapper: 'max-h-64',
                    popoverContent: CARD_STYLES.GLASS_SELECT.popoverContent
                  }}
                >
                  {proxyOptions.map((option) => (
                    <AutocompleteItem key={option}>{option}</AutocompleteItem>
                  ))}
                </Autocomplete>
              </div>

              {supportsNoResolve && (
                <div className="flex min-h-10 items-center justify-between gap-4 rounded-2xl border border-default-200/50 bg-content1/40 px-4 py-1.5 shadow-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 text-sm font-medium text-foreground-700">
                      no-resolve
                    </span>
                    <span className="truncate text-xs text-foreground-500">
                      {t('rules.noResolveHelp')}
                    </span>
                  </div>
                  <AppSwitch
                    size="sm"
                    color="primary"
                    isSelected={noResolve}
                    onValueChange={setNoResolve}
                  />
                </div>
              )}

              {ruleString && (
                <div className="flex min-h-10 items-center gap-3 rounded-2xl border border-default-200/50 bg-content1/40 px-4 py-1.5 shadow-sm">
                  <div className="shrink-0 text-xs font-medium text-foreground-500">
                    {t('rules.preview')}
                  </div>
                  <code className="min-w-0 truncate font-mono text-sm text-primary">
                    {ruleString}
                  </code>
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
