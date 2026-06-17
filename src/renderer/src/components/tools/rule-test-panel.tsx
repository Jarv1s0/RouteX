import React, { useState } from 'react'
import { Card, CardBody, Input, Button, Chip } from '@heroui/react'
import { IoShield, IoSearch } from 'react-icons/io5'
import { testRuleMatch } from '@renderer/utils/tools-ipc'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { useI18n } from '@renderer/i18n'

export const RuleTestPanel: React.FC = () => {
  const { t } = useI18n()
  const [ruleQuery, setRuleQuery] = useState('')
  const [ruleResult, setRuleResult] = useState<{
    rule: string
    rulePayload: string
    proxy: string
  } | null>(null)
  const [ruleLoading, setRuleLoading] = useState(false)
  const [ruleError, setRuleError] = useState<string | null>(null)

  const handleRuleTest = async (): Promise<void> => {
    if (!ruleQuery.trim()) return
    setRuleLoading(true)
    setRuleError(null)
    setRuleResult(null)
    try {
      const result = await testRuleMatch(ruleQuery.trim())
      if (result && result.rule) {
        setRuleResult(result)
      } else {
        setRuleError(t('tools.noRuleResult'))
      }
    } catch (e) {
      setRuleError(String(e))
    } finally {
      setRuleLoading(false)
    }
  }

  return (
    <Card className={`${CARD_STYLES.BASE} ${CARD_STYLES.INACTIVE} h-full hover:!scale-100 !cursor-default`}>
      <CardBody className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-warning/20">
            <IoShield className="text-warning text-lg" />
          </div>
          <span className="font-medium">{t('tools.ruleTest')}</span>
          <span className="text-foreground-400 text-xs">{t('tools.ruleTestHelp')}</span>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <Input
            size="sm"
            placeholder={t('tools.domainPlaceholder')}
            value={ruleQuery}
            onValueChange={setRuleQuery}
            onKeyDown={(e) => e.key === 'Enter' && handleRuleTest()}
            className="flex-1"
            classNames={CARD_STYLES.GLASS_INPUT}
          />
          <Button size="sm" color="warning" isLoading={ruleLoading} onPress={handleRuleTest} isIconOnly>
            <IoSearch />
          </Button>
        </div>

        {ruleError && <div className="text-danger text-sm">{ruleError}</div>}

        {ruleResult && (
          <div className="p-3 rounded-xl bg-content2/50 border border-default-200/50 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex flex-col gap-1">
              <span className="text-foreground-400 text-xs">{t('tools.matchedRule')}</span>
              <div className="font-mono text-sm bg-background/50 p-1.5 rounded-lg border border-default-100">
                {ruleResult.rule}
                {ruleResult.rulePayload ? `,${ruleResult.rulePayload}` : ''}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-foreground-400 text-xs">{t('tools.outboundProxy')}</span>
              <div>
                <Chip size="sm" variant="flat" color="success" className="h-6">
                  {ruleResult.proxy}
                </Chip>
              </div>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
