import { describe, expect, it } from 'vitest'
import { countRuleProviderRules, hasPendingRuleProviderCounts } from './rule-card-counts'

describe('rule-card-counts', () => {
  it('falls back to RULE-SET size while provider ruleCount is still empty', () => {
    const providers = {
      ad: { name: 'ad', ruleCount: 0 },
      google: { name: 'google', ruleCount: 6 }
    }
    const rules = [
      { type: 'RULE-SET', payload: 'ad', size: 120 },
      { type: 'RuleSet', payload: 'google', size: 8 }
    ]

    expect(countRuleProviderRules(providers, rules, [])).toBe(126)
    expect(hasPendingRuleProviderCounts(providers, rules)).toBe(false)
  })

  it('does not count disabled RULE-SET providers', () => {
    const providers = {
      ad: { name: 'ad', ruleCount: 120 },
      google: { name: 'google', ruleCount: 6 }
    }
    const rules = [
      { type: 'RULE-SET', payload: 'ad', size: 120 },
      { type: 'RULE-SET', payload: 'google', size: 6 }
    ]

    expect(countRuleProviderRules(providers, rules, [0])).toBe(6)
  })

  it('keeps startup polling when neither provider ruleCount nor RULE-SET size is ready', () => {
    const providers = {
      ad: { name: 'ad', ruleCount: 0 }
    }
    const rules = [{ type: 'RULE-SET', payload: 'ad', size: 0 }]

    expect(countRuleProviderRules(providers, rules, [])).toBe(0)
    expect(hasPendingRuleProviderCounts(providers, rules)).toBe(true)
  })
})
