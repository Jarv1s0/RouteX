import { C, invokeSafe } from './ipc-core'

export async function getQuickRulesConfig(force = false): Promise<QuickRulesConfig> {
  return invokeSafe(C.getQuickRulesConfig, force)
}

export async function setQuickRulesConfig(config: QuickRulesConfig): Promise<void> {
  return invokeSafe(C.setQuickRulesConfig, config)
}

export async function getQuickRules(profileId: string): Promise<QuickRuleProfileConfig> {
  return invokeSafe(C.getQuickRules, profileId)
}

export async function addQuickRule(profileId: string, rule: QuickRuleInput): Promise<QuickRule> {
  return invokeSafe(C.addQuickRule, profileId, rule)
}

export async function updateQuickRule(
  profileId: string,
  ruleId: string,
  patch: Partial<QuickRule>
): Promise<void> {
  return invokeSafe(C.updateQuickRule, profileId, ruleId, patch)
}

export async function removeQuickRule(profileId: string, ruleId: string): Promise<void> {
  return invokeSafe(C.removeQuickRule, profileId, ruleId)
}

export async function setQuickRulesEnabled(profileId: string, enabled: boolean): Promise<void> {
  return invokeSafe(C.setQuickRulesEnabled, profileId, enabled)
}

export async function reorderQuickRules(profileId: string, ruleIds: string[]): Promise<void> {
  return invokeSafe(C.reorderQuickRules, profileId, ruleIds)
}

export async function clearQuickRules(profileId: string): Promise<void> {
  return invokeSafe(C.clearQuickRules, profileId)
}
