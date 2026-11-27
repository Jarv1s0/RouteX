import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardBody, Input, Button, Chip } from '@heroui/react'
import { IoShield, IoSearch, IoCopy, IoCheckmarkCircle } from 'react-icons/io5'
import { testRuleMatch } from '@renderer/utils/tools-ipc'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { useI18n } from '@renderer/i18n'

const RULE_HISTORY_STORAGE_KEY = 'routex:tools:ruleHistory'
const MAX_HISTORY_COUNT = 5

function extractDomainForRule(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  try {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
      return new URL(trimmed).hostname
    }
  } catch {
    // 非标准 URL 时回退到文本提取
  }
  return trimmed.split('/')[0].split(':')[0].trim()
}

function loadRuleHistory(): string[] {
  try {
    const raw = localStorage.getItem(RULE_HISTORY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

interface RuleTestPanelProps {
  externalQuery?: { domain: string; trigger: number } | null
}

export const RuleTestPanel: React.FC<RuleTestPanelProps> = ({ externalQuery }) => {
  const { t } = useI18n()
  const [ruleQuery, setRuleQuery] = useState('')
  const [ruleResult, setRuleResult] = useState<{
    rule: string
    rulePayload: string
    proxy: string
  } | null>(null)
  const [ruleLoading, setRuleLoading] = useState(false)
  const [ruleError, setRuleError] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>(loadRuleHistory)
  const [copiedField, setCopiedField] = useState<'rule' | 'proxy' | null>(null)

  const recordHistory = useCallback((domain: string) => {
    setHistory((prev) => {
      const next = [domain, ...prev.filter((d) => d !== domain)].slice(0, MAX_HISTORY_COUNT)
      try {
        localStorage.setItem(RULE_HISTORY_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // ignore storage errors
      }
      return next
    })
  }, [])

  const runRuleTest = useCallback(
    async (rawInput: string): Promise<void> => {
      const target = rawInput.trim()
      const domain = extractDomainForRule(target)
      if (!target || !domain) return
      setRuleQuery(target)
      setRuleLoading(true)
      setRuleError(null)
      setRuleResult(null)
      try {
        const result = await testRuleMatch(target)
        if (result && result.rule) {
          setRuleResult(result)
          recordHistory(domain)
        } else {
          setRuleError(t('tools.noRuleResult'))
        }
      } catch (e) {
        setRuleError(e instanceof Error ? e.message : String(e))
      } finally {
        setRuleLoading(false)
      }
    },
    [recordHistory, t]
  )

  useEffect(() => {
    if (!externalQuery?.domain) return
    void runRuleTest(externalQuery.domain)
  }, [externalQuery, runRuleTest])

  const handleCopy = async (text: string, field: 'rule' | 'proxy'): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // ignore clipboard errors
    }
    setCopiedField(field)
    setTimeout(() => setCopiedField((prev) => (prev === field ? null : prev)), 1200)
  }

  const fullRuleText = ruleResult
    ? `${ruleResult.rule}${ruleResult.rulePayload ? `,${ruleResult.rulePayload}` : ''}`
    : ''

  return (
    <Card
      className={`${CARD_STYLES.BASE} ${CARD_STYLES.INACTIVE} h-full hover:!scale-100 !cursor-default`}
    >
      <CardBody className="p-2.5 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-warning/20 shrink-0">
            <IoShield className="text-warning text-base" />
          </div>
          <span className="font-medium text-sm shrink-0">{t('tools.ruleTest')}</span>
          <span className="text-foreground/70 text-xs truncate">{t('tools.ruleTestHelp')}</span>
        </div>

        <div className="flex items-center gap-2">
          <Input
            size="sm"
            placeholder={t('tools.domainPlaceholder')}
            value={ruleQuery}
            onValueChange={setRuleQuery}
            onKeyDown={(e) => e.key === 'Enter' && void runRuleTest(ruleQuery)}
            className="flex-1"
            classNames={CARD_STYLES.GLASS_INPUT}
          />
          <Button
            size="sm"
            color="warning"
            isLoading={ruleLoading}
            onPress={() => void runRuleTest(ruleQuery)}
            isIconOnly
          >
            <IoSearch />
          </Button>
        </div>

        {history.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {history.map((domain) => (
              <Chip
                key={domain}
                size="sm"
                variant="flat"
                className="h-5 text-[11px] cursor-pointer hover:bg-warning/20 transition-colors"
                onClick={() => void runRuleTest(domain)}
              >
                {domain}
              </Chip>
            ))}
          </div>
        )}

        {ruleError && <div className="text-danger text-sm">{ruleError}</div>}

        {ruleResult && (
          <div className="p-3 rounded-xl bg-default-100/50 border border-default-200/50 space-y-2 animate-fade-in-up">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-foreground/70 text-xs">{t('tools.matchedRule')}</span>
                <Button
                  size="sm"
                  isIconOnly
                  variant="light"
                  color={copiedField === 'rule' ? 'success' : 'default'}
                  className="h-5 w-5 min-w-5"
                  onPress={() => void handleCopy(fullRuleText, 'rule')}
                  title={t('common.copy')}
                >
                  {copiedField === 'rule' ? (
                    <IoCheckmarkCircle className="text-xs" />
                  ) : (
                    <IoCopy className="text-xs text-foreground/60" />
                  )}
                </Button>
              </div>
              <div className="font-mono text-sm bg-background/50 p-1.5 rounded-lg border border-default-200/50 break-all select-all">
                {fullRuleText}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-foreground/70 text-xs">{t('tools.outboundProxy')}</span>
              <div className="flex items-center gap-1.5">
                <Chip size="sm" variant="flat" color="success" className="h-6">
                  {ruleResult.proxy}
                </Chip>
                <Button
                  size="sm"
                  isIconOnly
                  variant="light"
                  color={copiedField === 'proxy' ? 'success' : 'default'}
                  className="h-5 w-5 min-w-5"
                  onPress={() => void handleCopy(ruleResult.proxy, 'proxy')}
                  title={t('common.copy')}
                >
                  {copiedField === 'proxy' ? (
                    <IoCheckmarkCircle className="text-xs" />
                  ) : (
                    <IoCopy className="text-xs text-foreground/60" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
