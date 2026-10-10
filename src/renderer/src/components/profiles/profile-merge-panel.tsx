import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Select,
  SelectItem,
  Spinner,
  Tooltip
} from '@heroui/react'
import { IoChevronForwardOutline, IoHelpCircleOutline } from 'react-icons/io5'
import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { useProfileConfig } from '@renderer/hooks/use-profile-config'
import { useMainPaneModalContentStyle } from '@renderer/hooks/use-main-pane-modal-style'
import SecondaryModalCloseButton from '@renderer/components/base/secondary-modal-close'
import SettingItem from '@renderer/components/base/base-setting-item'
import { useI18n } from '@renderer/i18n'
import { ON, onIpc } from '@renderer/utils/ipc-channels'
import { getProfileMergeReport, setProfileMergeTargets } from '@renderer/utils/profile-ipc'
import { notifyError } from '@renderer/utils/notify'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import {
  createSecondaryModalClassNames,
  SECONDARY_MODAL_HEADER_CLASSNAME
} from '@renderer/utils/modal-styles'

export default function ProfileMergePanel(): React.JSX.Element {
  const { t } = useI18n()
  const { profileConfig, mutateProfileConfig } = useProfileConfig()
  const current = profileConfig?.current
  const {
    data: report,
    error,
    isValidating,
    mutate
  } = useSWR(profileConfig ? ['getProfileMergeReport', current] : null, getProfileMergeReport)
  const savedTargetsKey = JSON.stringify(
    current ? (profileConfig?.mergeTargets?.[current] ?? []) : []
  )
  const savedTargets = useMemo(() => JSON.parse(savedTargetsKey) as string[], [savedTargetsKey])
  const [targets, setTargets] = useState<string[]>(savedTargets)
  const [saving, setSaving] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const modalContentStyle = useMainPaneModalContentStyle(720)

  useEffect(() => {
    setTargets(savedTargets)
  }, [current, savedTargets])

  useEffect(() => {
    void mutate()
  }, [profileConfig, mutate])

  useEffect(() => {
    const refresh = (): void => {
      void mutate()
    }
    const cleanups = [
      ON.profileConfigUpdated,
      ON.overrideConfigUpdated,
      ON.controledMihomoConfigUpdated,
      ON.appConfigUpdated,
      ON.quickRulesConfigUpdated
    ].map((channel) => onIpc(channel, refresh))
    return () => cleanups.forEach((cleanup) => cleanup())
  }, [mutate])

  const availableTargets = Array.from(
    new Set([...(report?.availableTargets ?? []), ...savedTargets])
  )
  const changed =
    targets.length !== savedTargets.length || targets.some((name) => !savedTargets.includes(name))
  const ready = report && report.primaryId === current && !error
  const providerCount =
    report?.members.reduce((count, member) => count + member.providers.length, 0) ?? 0
  const warningCount = report
    ? report.missingTargets.length +
      report.targets.reduce(
        (count, target) => count + target.skippedNodes.length + target.skippedProviders.length,
        0
      ) +
      report.members.reduce(
        (count, member) => count + member.discarded.length + member.discardedProviders.length,
        0
      )
    : 0
  const formatCounts = (nodes: number, providers: number): string =>
    [
      nodes > 0 || providers === 0 ? t('profiles.merge.nodeCount', { count: nodes }) : null,
      providers > 0 ? t('profiles.merge.providerCount', { count: providers }) : null
    ]
      .filter(Boolean)
      .join(' · ')

  const save = async (): Promise<void> => {
    if (!current || !ready) return
    setSaving(true)
    try {
      await setProfileMergeTargets(current, targets)
    } catch (e) {
      notifyError(e, { title: t('profiles.saveConfigFailed') })
    } finally {
      mutateProfileConfig()
      void mutate()
      setSaving(false)
    }
  }

  return (
    <section
      aria-label={t('profiles.merge.title')}
      className="mx-2 mb-3 border-b border-default-200/60 px-2 pb-3 pt-1"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="text-sm font-medium text-foreground">{t('profiles.merge.title')}</h3>
          {ready && (
            <span className="text-xs text-default-500">
              {t('profiles.merge.summary', {
                members: report.members.length,
                nodes: report.members.reduce((count, member) => count + member.nodes.length, 0)
              })}
              {providerCount > 0 &&
                ` · ${t('profiles.merge.providerCount', { count: providerCount })}`}
            </span>
          )}
          <Tooltip
            content={
              <div className="max-w-80 space-y-2 p-1 text-xs">
                <p>{t('profiles.merge.help')}</p>
                <p>{t('profiles.merge.filtersHelp')}</p>
              </div>
            }
          >
            <Button
              isIconOnly
              size="sm"
              variant="light"
              aria-label={t('profiles.merge.helpLabel')}
              className="h-6 w-6 min-w-6 text-default-400"
            >
              <IoHelpCircleOutline className="text-base" />
            </Button>
          </Tooltip>
        </div>
        <Button
          size="sm"
          color="primary"
          variant="flat"
          className="h-8 shrink-0 rounded-2xl px-3 text-sm"
          isDisabled={!ready}
          onPress={() => setReportOpen(true)}
        >
          {t('profiles.merge.viewReport')}
        </Button>
      </div>
      {(error || !ready || warningCount > 0) && (
        <div className="pt-2 text-sm">
          {error ? (
            <div role="alert" className="flex flex-wrap items-center gap-2 text-danger">
              <span className="break-all">
                {t('profiles.merge.loadFailed')}: {String(error)}
              </span>
              <Button
                size="sm"
                variant="light"
                onPress={() => {
                  void mutate()
                }}
              >
                {t('profiles.merge.retry')}
              </Button>
            </div>
          ) : !ready ? (
            <div role="status" className="flex items-center gap-2 text-default-500">
              <Spinner size="sm" />
              {t('profiles.merge.loading')}
            </div>
          ) : (
            <span role="status" className="text-xs text-warning">
              {t('profiles.merge.warningCount', { count: warningCount })}
            </span>
          )}
        </div>
      )}
      {reportOpen && ready && (
        <Modal
          backdrop="blur"
          classNames={createSecondaryModalClassNames()}
          size="2xl"
          hideCloseButton
          isOpen
          onOpenChange={() => setReportOpen(false)}
          scrollBehavior="inside"
        >
          <ModalContent
            style={modalContentStyle}
            className="flex max-h-[calc(100vh-4rem)] flex-col overflow-hidden"
          >
            <ModalHeader className={SECONDARY_MODAL_HEADER_CLASSNAME}>
              <span>{t('profiles.merge.reportTitle')}</span>
              <SecondaryModalCloseButton onPress={() => setReportOpen(false)} />
            </ModalHeader>
            <ModalBody className="min-h-0 flex-1 gap-5 overflow-y-auto px-6 py-4 text-sm">
              {report.targets.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-foreground">
                    {t('profiles.merge.targets')}
                  </h4>
                  {report.targets.map((target) => (
                    <div
                      key={target.name}
                      className="space-y-1 rounded-xl border border-default-200/50 bg-default-100/50 px-3 py-2 [overflow-wrap:anywhere]"
                    >
                      <p className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                        <span className="font-medium">{target.name}</span>
                        <span className="text-default-500">
                          {formatCounts(target.addedNodes, target.addedProviders)}
                        </span>
                      </p>
                      {(target.skippedNodes.length > 0 || target.skippedProviders.length > 0) && (
                        <p className="text-xs text-warning">
                          {t('profiles.merge.cycle', {
                            names: [...target.skippedNodes, ...target.skippedProviders].join('、')
                          })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {report.missingTargets.length > 0 && (
                <p role="alert" className="text-xs text-warning break-all">
                  {t('profiles.merge.missingTargets', { names: report.missingTargets.join('、') })}
                </p>
              )}
              <div>
                <h4 className="pb-2 text-sm font-medium text-foreground">
                  {t('profiles.merge.sources')}
                </h4>
                <div className="space-y-2">
                  {report.members.map((member) => (
                    <details
                      key={member.id}
                      className="group rounded-xl border border-default-200/50 bg-default-100/50"
                    >
                      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2 text-foreground transition-colors hover:bg-default-200/40 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
                        <IoChevronForwardOutline
                          aria-hidden="true"
                          className="shrink-0 text-sm text-default-400 transition-transform group-open:rotate-90"
                        />
                        <span className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-1">
                          <span className="min-w-0 flex-1 break-all font-medium">
                            {member.name}
                            {member.primary && (
                              <span className="ml-2 rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-normal text-primary">
                                {t('profiles.status.primary')}
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-default-500">
                            {formatCounts(member.nodes.length, member.providers.length)}
                          </span>
                        </span>
                      </summary>
                      <div className="space-y-2 border-t border-default-200/50 px-3 py-3 text-xs leading-relaxed text-default-500 [overflow-wrap:anywhere]">
                        {member.renamed.length > 0 && (
                          <p>
                            {t('profiles.merge.renamedCount', { count: member.renamed.length })}
                          </p>
                        )}
                        {member.nodes.length > 0 && (
                          <p>
                            <span className="font-medium text-primary">
                              {t('profiles.merge.nodes')}:
                            </span>{' '}
                            {member.nodes.join('、')}
                          </p>
                        )}
                        {member.providers.length > 0 && (
                          <p>Provider: {member.providers.join('、')}</p>
                        )}
                        {member.renamed.map((rename, index) => (
                          <p key={index}>
                            {rename.kind === 'provider' ? 'Provider: ' : ''}
                            {rename.from} → {rename.to}
                          </p>
                        ))}
                        {member.discarded.map((node, index) => (
                          <p key={index} className="text-warning">
                            {t('profiles.merge.discarded', {
                              name: node.name,
                              dialer: node.dialerProxy
                            })}
                          </p>
                        ))}
                        {member.discardedProviders.map((provider, index) => (
                          <p key={`provider-${index}`} className="text-warning">
                            {t('profiles.merge.providerDialerMissing', {
                              name: provider.name,
                              dialer: provider.dialerProxy
                            })}
                          </p>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
              <section className="space-y-2">
                <h4 className="text-sm font-medium">{t('profiles.merge.settings')}</h4>
                <div className="rounded-2xl border border-default-200/50 bg-default-100/50 px-4 py-2">
                  <SettingItem
                    title={t('profiles.merge.targets')}
                    actions={
                      <Tooltip
                        placement="bottom"
                        content={
                          <div className="max-w-80 space-y-2 p-1 text-xs leading-relaxed">
                            <p>{t('profiles.merge.targetsHelp')}</p>
                            <p>{t('profiles.merge.filtersHelp')}</p>
                          </div>
                        }
                      >
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          className="h-6 w-6 min-w-6 text-default-400"
                          aria-label={t('profiles.merge.targetsHelpLabel')}
                        >
                          <IoHelpCircleOutline className="text-base" />
                        </Button>
                      </Tooltip>
                    }
                  >
                    <div className="flex min-w-0 w-[65%] flex-wrap items-center justify-end gap-2">
                      <Select
                        placeholder={t('profiles.merge.noTargets')}
                        aria-label={t('profiles.merge.targets')}
                        selectionMode="multiple"
                        size="sm"
                        className="min-w-32 flex-1"
                        classNames={{
                          ...CARD_STYLES.GLASS_SELECT,
                          trigger: `${CARD_STYLES.GLASS_SELECT.trigger} border-default-200 bg-default-100/50 dark:border-white/15 dark:bg-default-100/40`
                        }}
                        selectedKeys={new Set(targets)}
                        isDisabled={saving || isValidating}
                        onSelectionChange={(keys) =>
                          setTargets(keys === 'all' ? availableTargets : Array.from(keys, String))
                        }
                      >
                        {availableTargets.map((name) => (
                          <SelectItem key={name} textValue={name}>
                            <span className="break-all">{name}</span>
                          </SelectItem>
                        ))}
                      </Select>
                      <Button
                        size="sm"
                        color="primary"
                        isLoading={saving}
                        isDisabled={!changed || isValidating}
                        onPress={save}
                      >
                        {t('profiles.merge.apply')}
                      </Button>
                    </div>
                  </SettingItem>
                </div>
              </section>
              <p className="text-xs leading-relaxed text-default-500">
                {t('profiles.merge.reportHelp')}
              </p>
            </ModalBody>
          </ModalContent>
        </Modal>
      )}
    </section>
  )
}
