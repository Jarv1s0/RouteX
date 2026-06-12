import { Autocomplete, AutocompleteItem, Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem } from '@heroui/react'
import React, { useCallback, useMemo, useState } from 'react'
import SecondaryModalCloseButton from '@renderer/components/base/secondary-modal-close'
import { useMainPaneModalContentStyle } from '@renderer/hooks/use-main-pane-modal-style'
import { useGroups } from '@renderer/hooks/use-groups'
import { addQuickRule, updateQuickRule } from '@renderer/utils/quick-rules-ipc'
import { secondaryInputClassNames } from '@renderer/components/settings/advanced-settings'
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

import AppSwitch from '@renderer/components/base/app-switch'
interface Props {
  profileId: string
  rule?: QuickRule | null
  onClose: () => void
  onSaved: () => Promise<void> | void
}

const QuickRuleEditorModal: React.FC<Props> = ({ profileId, rule, onClose, onSaved }) => {
  const { t } = useI18n()
  const { groups = [] } = useGroups()
  const modalContentStyle = useMainPaneModalContentStyle(640)
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
    const options = [...COMMON_RULE_TARGETS]
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
    setRuleValue(getSuggestedRuleValue(selectedKey))
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
        style={modalContentStyle}
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
                  <AppSwitch
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
