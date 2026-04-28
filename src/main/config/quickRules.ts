import { quickRulesConfigPath } from '../utils/dirs'
import { parseYaml, stringifyYaml } from '../utils/yaml'
import { existsSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { getOverride, getOverrideConfig } from './override'
import { getProfileConfig, setProfileConfig } from './profile'

const QUICK_RULES_VERSION = 1
const LEGACY_QUICK_RULES_ID = 'quick-rules'

let quickRulesConfig: QuickRulesConfig

function defaultQuickRulesConfig(): QuickRulesConfig {
  return {
    version: QUICK_RULES_VERSION,
    migratedLegacyQuickRules: false,
    profiles: {}
  }
}

function normalizeQuickRulesConfig(config?: Partial<QuickRulesConfig>): QuickRulesConfig {
  const profiles = config?.profiles && typeof config.profiles === 'object' ? config.profiles : {}
  for (const profileId of Object.keys(profiles)) {
    const profileConfig = profiles[profileId]
    profiles[profileId] = {
      enabled: profileConfig?.enabled !== false,
      rules: Array.isArray(profileConfig?.rules)
        ? profileConfig.rules.filter((rule): rule is QuickRule => Boolean(rule?.id))
        : []
    }
  }
  return {
    version: QUICK_RULES_VERSION,
    migratedLegacyQuickRules: config?.migratedLegacyQuickRules ?? false,
    profiles
  }
}

function parseRuleString(raw: string): QuickRuleInput | null {
  const parts = raw.split(',').map((part) => part.trim())
  if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) return null
  return {
    type: parts[0],
    value: parts[1],
    target: parts[2],
    noResolve: parts.length > 3 && parts[3] === 'no-resolve',
    source: 'connection'
  }
}

function getRuleString(rule: QuickRule): string {
  let value = `${rule.type},${rule.value},${rule.target}`
  if (rule.noResolve) value += ',no-resolve'
  return value
}

function parseLegacyQuickRules(content: string): QuickRuleInput[] {
  const rules: QuickRuleInput[] = []
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('- ')) continue
    const parsed = parseRuleString(trimmed.slice(2).trim())
    if (parsed) rules.push(parsed)
  }
  return rules
}

function ensureProfileConfig(profileId: string): QuickRuleProfileConfig {
  if (!quickRulesConfig.profiles[profileId]) {
    quickRulesConfig.profiles[profileId] = {
      enabled: true,
      rules: []
    }
  }
  return quickRulesConfig.profiles[profileId]
}

async function migrateLegacyQuickRules(): Promise<void> {
  if (quickRulesConfig.migratedLegacyQuickRules) return

  const overrideConfig = await getOverrideConfig()
  const legacyItem = overrideConfig.items?.find((item) => item.id === LEGACY_QUICK_RULES_ID)
  if (!legacyItem) {
    quickRulesConfig.migratedLegacyQuickRules = true
    await setQuickRulesConfig(quickRulesConfig)
    return
  }

  const legacyContent = await getOverride(LEGACY_QUICK_RULES_ID, 'yaml')
  const legacyRules = parseLegacyQuickRules(legacyContent)
  const profileConfig = await getProfileConfig()
  let profileConfigChanged = false

  if (legacyRules.length > 0) {
    for (const profile of profileConfig.items) {
      if (!profile.override?.includes(LEGACY_QUICK_RULES_ID)) continue
      const quickRuleProfile = ensureProfileConfig(profile.id)
      const existingRuleStrings = new Set(quickRuleProfile.rules.map(getRuleString))
      for (const legacyRule of legacyRules) {
        const now = Date.now()
        const rule = {
          id: randomUUID(),
          enabled: true,
          createdAt: now,
          updatedAt: now,
          ...legacyRule
        }
        if (!existingRuleStrings.has(getRuleString(rule))) {
          quickRuleProfile.rules.push(rule)
        }
      }
    }
  }

  for (const profile of profileConfig.items) {
    if (!profile.override?.includes(LEGACY_QUICK_RULES_ID)) continue
    profile.override = profile.override.filter((id) => id !== LEGACY_QUICK_RULES_ID)
    profileConfigChanged = true
  }

  if (profileConfigChanged) {
    await setProfileConfig(profileConfig)
  }
  quickRulesConfig.migratedLegacyQuickRules = true
  await setQuickRulesConfig(quickRulesConfig)
}

export async function getQuickRulesConfig(force = false): Promise<QuickRulesConfig> {
  if (force || !quickRulesConfig) {
    if (existsSync(quickRulesConfigPath())) {
      const data = await readFile(quickRulesConfigPath(), 'utf-8')
      quickRulesConfig = normalizeQuickRulesConfig(parseYaml<QuickRulesConfig>(data))
    } else {
      quickRulesConfig = defaultQuickRulesConfig()
      await setQuickRulesConfig(quickRulesConfig)
    }
  }
  await migrateLegacyQuickRules()
  return quickRulesConfig
}

export async function setQuickRulesConfig(config: QuickRulesConfig): Promise<void> {
  quickRulesConfig = normalizeQuickRulesConfig(config)
  await writeFile(quickRulesConfigPath(), stringifyYaml(quickRulesConfig), 'utf-8')
}

export async function getQuickRules(profileId: string): Promise<QuickRuleProfileConfig> {
  await getQuickRulesConfig()
  const profileConfig = ensureProfileConfig(profileId)
  return structuredClone(profileConfig)
}

export async function addQuickRule(profileId: string, input: QuickRuleInput): Promise<QuickRule> {
  await getQuickRulesConfig()
  const now = Date.now()
  const rule: QuickRule = {
    id: input.id || randomUUID(),
    type: input.type,
    value: input.value,
    target: input.target,
    noResolve: input.noResolve ?? false,
    enabled: input.enabled ?? true,
    source: input.source,
    createdAt: now,
    updatedAt: now
  }
  ensureProfileConfig(profileId).rules.unshift(rule)
  await setQuickRulesConfig(quickRulesConfig)
  return rule
}

export async function updateQuickRule(
  profileId: string,
  ruleId: string,
  patch: Partial<QuickRule>
): Promise<void> {
  await getQuickRulesConfig()
  const rules = ensureProfileConfig(profileId).rules
  const index = rules.findIndex((rule) => rule.id === ruleId)
  if (index === -1) throw new Error('Quick rule not found')
  rules[index] = {
    ...rules[index],
    ...patch,
    id: ruleId,
    updatedAt: Date.now()
  }
  await setQuickRulesConfig(quickRulesConfig)
}

export async function removeQuickRule(profileId: string, ruleId: string): Promise<void> {
  await getQuickRulesConfig()
  const profileConfig = ensureProfileConfig(profileId)
  profileConfig.rules = profileConfig.rules.filter((rule) => rule.id !== ruleId)
  await setQuickRulesConfig(quickRulesConfig)
}

export async function setQuickRulesEnabled(profileId: string, enabled: boolean): Promise<void> {
  await getQuickRulesConfig()
  ensureProfileConfig(profileId).enabled = enabled
  await setQuickRulesConfig(quickRulesConfig)
}

export async function reorderQuickRules(profileId: string, ruleIds: string[]): Promise<void> {
  await getQuickRulesConfig()
  const profileConfig = ensureProfileConfig(profileId)
  const rulesById = new Map(profileConfig.rules.map((rule) => [rule.id, rule]))
  const orderedRules = ruleIds
    .map((id) => rulesById.get(id))
    .filter((rule): rule is QuickRule => Boolean(rule))
  const orderedIds = new Set(orderedRules.map((rule) => rule.id))
  profileConfig.rules = [
    ...orderedRules,
    ...profileConfig.rules.filter((rule) => !orderedIds.has(rule.id))
  ]
  await setQuickRulesConfig(quickRulesConfig)
}

export async function clearQuickRules(profileId: string): Promise<void> {
  await getQuickRulesConfig()
  ensureProfileConfig(profileId).rules = []
  await setQuickRulesConfig(quickRulesConfig)
}

export async function getQuickRuleStrings(profileId: string | undefined): Promise<string[]> {
  if (!profileId) return []
  const profileConfig = await getQuickRules(profileId)
  if (!profileConfig.enabled) return []
  return profileConfig.rules.filter((rule) => rule.enabled).map(getRuleString)
}
