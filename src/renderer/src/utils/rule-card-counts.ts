type RuleProviderCountMap = Record<string, Pick<ControllerRuleProviderDetail, 'ruleCount'>>
type RuleCountDetail = Pick<ControllerRulesDetail, 'type' | 'payload' | 'size'>

const normalizeRuleType = (type: string): string => type.replace(/[^a-z0-9]/gi, '').toLowerCase()

const isRuleSetRule = (rule: RuleCountDetail | undefined): rule is RuleCountDetail => {
  return !!rule && normalizeRuleType(rule.type) === 'ruleset'
}

function buildRuleSetSizeByProvider(rules: RuleCountDetail[] | undefined): Map<string, number> {
  const sizes = new Map<string, number>()

  rules?.forEach((rule) => {
    if (!isRuleSetRule(rule) || rule.size <= 0) {
      return
    }

    sizes.set(rule.payload, Math.max(sizes.get(rule.payload) ?? 0, rule.size))
  })

  return sizes
}

export function countRuleProviderRules(
  providerMap: RuleProviderCountMap | undefined,
  rules: RuleCountDetail[] | undefined,
  disabledRuleIndices: number[]
): number {
  if (!providerMap) {
    return 0
  }

  const ruleSetSizeByProvider = buildRuleSetSizeByProvider(rules)
  const disabledProviderNames = new Set<string>()

  if (rules && disabledRuleIndices.length > 0) {
    disabledRuleIndices.forEach((index) => {
      const rule = rules[index]
      if (isRuleSetRule(rule) && providerMap[rule.payload]) {
        disabledProviderNames.add(rule.payload)
      }
    })
  }

  return Object.entries(providerMap).reduce((total, [name, provider]) => {
    if (disabledProviderNames.has(name)) {
      return total
    }

    return total + (provider.ruleCount || ruleSetSizeByProvider.get(name) || 0)
  }, 0)
}

export function hasPendingRuleProviderCounts(
  providerMap: RuleProviderCountMap | undefined,
  rules: RuleCountDetail[] | undefined
): boolean {
  if (!providerMap || !rules) {
    return false
  }

  const ruleSetSizeByProvider = buildRuleSetSizeByProvider(rules)
  const referencedProviderNames = new Set(
    rules
      .filter((rule) => isRuleSetRule(rule) && providerMap[rule.payload])
      .map((rule) => rule.payload)
  )

  return Array.from(referencedProviderNames).some((name) => {
    return providerMap[name].ruleCount <= 0 && !ruleSetSizeByProvider.has(name)
  })
}
