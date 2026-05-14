import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { enUS } from './locales/en-US'
import { zhCN } from './locales/zh-CN'

export type Locale = 'zh-CN' | 'en-US'
export type LanguagePreference = 'system' | Locale
export type TranslationKey = keyof typeof zhCN

const DEFAULT_LOCALE: Locale = 'zh-CN'

const messages: Record<Locale, Record<TranslationKey, string>> = {
  'zh-CN': zhCN,
  'en-US': enUS
}

interface I18nContextValue {
  locale: Locale
  language: LanguagePreference
  setLanguage: (language: LanguagePreference) => Promise<void>
  t: (key: TranslationKey, values?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)
let activeLocale: Locale = DEFAULT_LOCALE

function resolveSystemLocale(): Locale {
  if (navigator.language.toLowerCase().startsWith('en')) {
    return 'en-US'
  }

  return DEFAULT_LOCALE
}

function resolveLocale(language: LanguagePreference): Locale {
  return language === 'system' ? resolveSystemLocale() : language
}

function normalizeLanguage(language: unknown): LanguagePreference | undefined {
  return language === 'system' || language === 'zh-CN' || language === 'en-US'
    ? language
    : undefined
}

function formatMessage(message: string, values?: Record<string, string | number>): string {
  if (!values) {
    return message
  }

  return message.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key]
    return value === undefined ? match : String(value)
  })
}

export function translate(key: TranslationKey, values?: Record<string, string | number>): string {
  return formatMessage(messages[activeLocale][key] || messages[DEFAULT_LOCALE][key] || key, values)
}

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const [localLanguage, setLocalLanguage] = useState<LanguagePreference>('system')
  const configuredLanguage = normalizeLanguage(appConfig?.language)
  const language = configuredLanguage || localLanguage
  const locale = resolveLocale(language)
  activeLocale = locale

  useEffect(() => {
    if (configuredLanguage) {
      setLocalLanguage(configuredLanguage)
    }
  }, [configuredLanguage])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo<I18nContextValue>(() => {
    return {
      locale,
      language,
      setLanguage: async (nextLanguage) => {
        setLocalLanguage(nextLanguage)
        await patchAppConfig({ language: nextLanguage })
      },
      t: (key, values) => translate(key, values)
    }
  }, [language, locale, patchAppConfig])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider')
  }

  return context
}
