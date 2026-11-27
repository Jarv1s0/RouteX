import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LuRotateCcw } from 'react-icons/lu'
import { version } from '@renderer/utils/init'
import { useI18n, type TranslationKey } from '@renderer/i18n'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import appIcon from '@renderer/assets/app-icon.png'
import UpdaterButton from '@renderer/components/updater/updater-button'

interface LatestVersion {
  version: string
  releaseNotes: string
}

interface Props {
  latest?: LatestVersion
}

const SIGNATURE_STORAGE_KEY = 'routex.sidebar.nameplate.signature'
const MAX_SIGNATURE_LENGTH = 48

function readStoredSignature(): string {
  try {
    return window.localStorage.getItem(SIGNATURE_STORAGE_KEY)?.trim() ?? ''
  } catch {
    return ''
  }
}

function writeStoredSignature(value: string): void {
  try {
    if (value) {
      window.localStorage.setItem(SIGNATURE_STORAGE_KEY, value)
    } else {
      window.localStorage.removeItem(SIGNATURE_STORAGE_KEY)
    }
  } catch {
    // 忽略受限环境下的存储异常，保证渲染安全
  }
}

function resolveAmbientPhraseKey(hour: number, mode?: OutboundMode): TranslationKey {
  if (mode === 'direct') {
    return 'sidebar.nameplate.phraseDirect'
  }
  if (hour >= 5 && hour < 12) {
    return 'sidebar.nameplate.phraseMorning'
  }
  if (hour >= 12 && hour < 18) {
    return 'sidebar.nameplate.phraseAfternoon'
  }
  if (hour >= 18 && hour < 23) {
    return 'sidebar.nameplate.phraseEvening'
  }
  return 'sidebar.nameplate.phraseNight'
}

const SidebarNameplate: React.FC<Props> = ({ latest }) => {
  const { t } = useI18n()
  const { controledMihomoConfig } = useControledMihomoConfig()

  const mode = controledMihomoConfig?.mode

  const [signature, setSignature] = useState<string>(() => readStoredSignature())
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [currentHour, setCurrentHour] = useState<number>(() => new Date().getHours())

  const inputRef = useRef<HTMLInputElement>(null)
  const skipBlurSaveRef = useRef(false)

  // 低频刷新本地时段问候语，页面不可见时自动暂停
  useEffect(() => {
    let intervalId: number | undefined

    const syncHour = (): void => {
      if (!document.hidden) {
        setCurrentHour(new Date().getHours())
      }
    }

    const startTimer = (): void => {
      if (intervalId !== undefined || document.hidden) return
      intervalId = window.setInterval(syncHour, 60_000)
    }

    const stopTimer = (): void => {
      if (intervalId === undefined) return
      window.clearInterval(intervalId)
      intervalId = undefined
    }

    const handleVisibilityChange = (): void => {
      if (document.hidden) {
        stopTimer()
      } else {
        syncHour()
        startTimer()
      }
    }

    startTimer()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      stopTimer()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    if (!editing) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editing])

  const startEditing = useCallback((): void => {
    skipBlurSaveRef.current = false
    setDraft(signature)
    setEditing(true)
  }, [signature])

  const commitSignature = useCallback((nextRaw: string): void => {
    const normalized = nextRaw.trim().slice(0, MAX_SIGNATURE_LENGTH)
    setSignature(normalized)
    writeStoredSignature(normalized)
    setEditing(false)
  }, [])

  const cancelEditing = useCallback((): void => {
    skipBlurSaveRef.current = true
    setEditing(false)
  }, [])

  const resetSignature = useCallback((): void => {
    skipBlurSaveRef.current = true
    setSignature('')
    setDraft('')
    writeStoredSignature('')
    setEditing(false)
  }, [])

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      skipBlurSaveRef.current = true
      commitSignature(draft)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      cancelEditing()
    }
  }

  const handleInputBlur = (): void => {
    if (skipBlurSaveRef.current) {
      skipBlurSaveRef.current = false
      return
    }
    commitSignature(draft)
  }

  const ambientPhrase = useMemo(
    () => t(resolveAmbientPhraseKey(currentHour, mode)),
    [currentHour, mode, t]
  )
  const displaySignature = signature || ambientPhrase

  return (
    <section
      aria-label="RouteX Nameplate"
      className="mt-auto flex shrink-0 items-center gap-2.5 px-1.5 py-1"
    >
      {/* 左侧软件图标 */}
      <img
        src={appIcon}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="h-8 w-8 shrink-0 object-contain"
      />

      {/* 中间双行落款信息 */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        {/* 第一行：品牌渐变署名与版本 */}
        <div className="flex h-5 items-center gap-1.5 leading-5">
          <span className="truncate text-[13px] font-bold tracking-tight bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 bg-clip-text text-transparent dark:from-cyan-400 dark:via-blue-400 dark:to-indigo-400">
            RouteX
          </span>
          {version ? (
            <span className="shrink-0 text-[11px] font-data-numeric text-foreground/65">
              v{version}
            </span>
          ) : null}
        </div>

        {/* 第二行：自定义签名 / 时段问候（双击即可内联编辑） */}
        <div className="flex h-5 items-center">
          {editing ? (
            <div className="flex w-full items-center gap-1">
              <input
                ref={inputRef}
                type="text"
                value={draft}
                maxLength={MAX_SIGNATURE_LENGTH}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleInputKeyDown}
                onBlur={handleInputBlur}
                placeholder={t('sidebar.nameplate.signaturePlaceholder')}
                aria-label={t('sidebar.nameplate.signaturePlaceholder')}
                className="select-text h-5 min-w-0 flex-1 rounded-md border border-primary/40 bg-white/80 px-1.5 text-[12px] leading-5 text-foreground outline-none focus:border-primary dark:bg-black/35"
              />
              {signature ? (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={resetSignature}
                  title={t('sidebar.nameplate.resetSignature')}
                  aria-label={t('sidebar.nameplate.resetSignature')}
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-foreground/65 transition-colors hover:bg-default-200/60 hover:text-foreground dark:hover:bg-white/10"
                >
                  <LuRotateCcw className="text-[12px]" />
                </button>
              ) : null}
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onDoubleClick={startEditing}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === 'F2') {
                  event.preventDefault()
                  startEditing()
                }
              }}
              title={`${displaySignature} · ${t('sidebar.nameplate.signatureHint')}`}
              className="flex h-5 w-full min-w-0 items-center text-left text-[12px] leading-5 text-foreground/80 transition-colors hover:text-foreground cursor-default"
            >
              <span className="truncate font-medium">{displaySignature}</span>
            </div>
          )}
        </div>
      </div>

      {/* 右侧新版本下载提示 */}
      {latest && latest.version ? (
        <div className="shrink-0">
          <UpdaterButton latest={latest} compact />
        </div>
      ) : null}
    </section>
  )
}

export default SidebarNameplate
