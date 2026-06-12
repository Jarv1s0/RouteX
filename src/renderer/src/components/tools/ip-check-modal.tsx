import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Button,
  Select,
  SelectItem,
  Spinner,
  Input
} from '@heroui/react'
import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { mihomoChangeProxy } from '@renderer/utils/mihomo-ipc'
import { testRuleMatch } from '@renderer/utils/tools-ipc'
import { useGroups } from '@renderer/hooks/use-groups'
import { useMainPaneModalContentStyle } from '@renderer/hooks/use-main-pane-modal-style'
import { IoOpenOutline, IoReload } from 'react-icons/io5'
import { createSecondaryModalClassNames } from '@renderer/utils/modal-styles'
import { useI18n } from '@renderer/i18n'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export const IPCheckModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { t } = useI18n()
  const { groups = [], mutate } = useGroups()
  const modalContentStyle = useMainPaneModalContentStyle(1400)
  const isTauriHost = __ROUTEX_HOST__ === 'tauri'

  // Site Selection State
  const [targetUrl, setTargetUrl] = useState<string>('https://ping0.cc/')
  const [customUrl, setCustomUrl] = useState<string>('')
  const [isCustom, setIsCustom] = useState(false)
  const [activeUrl, setActiveUrl] = useState<string>('https://ping0.cc/')

  // Route Control State
  const [autoMatchGroup, setAutoMatchGroup] = useState<string>('') // The group matched by rule
  const [selectedGroup, setSelectedGroup] = useState<string>('') // The group user is currently controlling
  const [loadingMatch, setLoadingMatch] = useState(false)
  const iframeRef = useRef<Electron.WebviewTag | HTMLIFrameElement | null>(null)
  const sites = useMemo(
    () => [
      { name: `Ping0 (${t('tools.ipCheck.purity')})`, url: 'https://ping0.cc/' },
      { name: `IP.SB (${t('tools.ipCheck.ipInfo')})`, url: 'https://ip.sb/' },
      { name: `Whoer (${t('tools.ipCheck.anonymity')})`, url: 'https://whoer.net/' },
      { name: `IP138 (${t('tools.ipCheck.domesticQuery')})`, url: 'https://www.ip138.com/' },
      { name: t('tools.ipCheck.customUrl'), url: 'custom' }
    ],
    [t]
  )

  const reloadCurrentFrame = useCallback(() => {
    const frame = iframeRef.current
    if (!frame) return
    const currentSrc = frame.src
    frame.src = currentSrc
  }, [])

  // Safe Switch: When URL changes, we manually manage the iframe src to avoid React unmount/remount crashes
  const handleSafeUrlChange = useCallback((newUrl: string) => {
    setActiveUrl(newUrl)

    // Safety: Navigate to blank first to unload heavy scripts from previous site
    if (iframeRef.current) {
      iframeRef.current.src = 'about:blank'
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = newUrl
        }
      }, 100)
    }
  }, [])

  // 1. Auto-detect route when URL changes or Modal opens
  useEffect(() => {
    if (isOpen) {
      if (!activeUrl) return

      setLoadingMatch(true)
      try {
        let domain = ''
        try {
          domain = new URL(activeUrl).hostname
        } catch {
          return
        }

        testRuleMatch(domain)
          .then((res) => {
            if (res && res.proxy) {
              setAutoMatchGroup(res.proxy)
              // If user hasn't manually selected a group yet (or just opened), auto-switch to matched
              setSelectedGroup(res.proxy)
            }
          })
          .finally(() => setLoadingMatch(false))
      } catch {
        setLoadingMatch(false)
      }
    }
  }, [isOpen, activeUrl])

  // Get current selected group details
  const currentGroupDetail = useMemo(() => {
    if (!groups) return undefined
    return groups.find((g) => g.name === selectedGroup)
  }, [groups, selectedGroup])

  const currentNode = currentGroupDetail?.now || ''
  const isSelectable = currentGroupDetail?.type === 'Selector'

  const handleNodeChange = async (nodeName: string) => {
    if (!selectedGroup) return
    await mihomoChangeProxy(selectedGroup, nodeName)
    mutate()
    reloadCurrentFrame()
  }

  const handleSiteChange = (key: string) => {
    let newUrl = ''
    if (key === 'custom') {
      setIsCustom(true)
      newUrl = customUrl
    } else {
      setIsCustom(false)
      setTargetUrl(key)
      newUrl = key
    }
    if (newUrl) handleSafeUrlChange(newUrl)
  }

  const handleCustomUrlSubmit = (val: string) => {
    setCustomUrl(val)
    handleSafeUrlChange(val)
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      size="5xl"
      scrollBehavior="inside"
      classNames={createSecondaryModalClassNames({
        body: 'p-0 overflow-hidden',
        base: 'h-[90vh]'
      })}
    >
      <ModalContent
        style={modalContentStyle}
      >
        <ModalHeader className="flex flex-col gap-3 py-4 border-b border-default-100 pr-10">
          {/* Top Bar: Site Selection & Actions */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1">
              <Select
                labelPlacement="outside"
                size="sm"
                className="w-48"
                selectedKeys={isCustom ? ['custom'] : [targetUrl]}
                onChange={(e) => handleSiteChange(e.target.value)}
                aria-label="Select Site"
              >
                {sites.map((site) => (
                  <SelectItem key={site.url} textValue={site.name}>
                    {site.name}
                  </SelectItem>
                ))}
              </Select>

              {isCustom && (
                <Input
                  size="sm"
                  placeholder={t('tools.ipCheck.customUrlPlaceholder')}
                  value={customUrl}
                  onValueChange={handleCustomUrlSubmit}
                  className="flex-1 max-w-sm"
                />
              )}

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="flat"
                  onPress={reloadCurrentFrame}
                  startContent={<IoReload />}
                >
                  {t('common.refresh')}
                </Button>
                <Button
                  size="sm"
                  color="primary"
                  variant="flat"
                  onPress={() => window.open(activeUrl, '_blank')}
                  startContent={<IoOpenOutline />}
                >
                  {t('tools.ipCheck.openBrowser')}
                </Button>
              </div>
            </div>
          </div>

          {/* Control Bar: Proxy Group & Node Selector */}
          <div className="flex items-center gap-4 text-small font-normal bg-default-50 p-2.5 rounded-xl border border-default-100">
            {/* 1. Group Selector */}
            <div className="flex items-center gap-2 min-w-[200px]">
              <span className="text-foreground-500 shrink-0">{t('tools.ipCheck.proxyGroup')}</span>
              <Select
                size="sm"
                aria-label="Select Proxy Group"
                selectedKeys={selectedGroup ? [selectedGroup] : []}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="flex-1"
                disallowEmptySelection
              >
                {groups
                  .filter((g) => g.type === 'Selector' || g.name === 'GLOBAL')
                  .map((g) => (
                    <SelectItem key={g.name} textValue={g.name}>
                      {g.name}{' '}
                      {autoMatchGroup === g.name ? `(${t('tools.ipCheck.autoMatched')})` : ''}
                    </SelectItem>
                  ))}
              </Select>
            </div>

            {/* 2. Node Selector (if applicable) */}
            {currentGroupDetail && isSelectable ? (
              <div className="flex items-center gap-2 flex-1 border-l border-default-200 pl-4">
                <span className="text-foreground-500 shrink-0">
                  {t('tools.ipCheck.selectNode')}
                </span>
                <Select
                  size="sm"
                  aria-label="Select Node"
                  selectedKeys={currentNode ? [currentNode] : []}
                  onChange={(e) => handleNodeChange(e.target.value)}
                  className="flex-1 max-w-md"
                >
                  {currentGroupDetail.all.map((proxy) => (
                    <SelectItem key={proxy.name} textValue={proxy.name}>
                      {proxy.name}
                    </SelectItem>
                  ))}
                </Select>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-1 border-l border-default-200 pl-4 text-foreground-400">
                <span>
                  {t('tools.ipCheck.currentNode', { node: currentNode || t('common.none') })}
                </span>
                <span className="text-xs text-warning ml-1">
                  ({t('tools.ipCheck.notSwitchable')})
                </span>
              </div>
            )}

            {/* Loading Indicator */}
            {loadingMatch && (
              <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 px-2 py-1 rounded-lg">
                <Spinner size="sm" color="current" />
                <span>{t('tools.ipCheck.analyzingRoute')}</span>
              </div>
            )}
          </div>
        </ModalHeader>
        <ModalBody>
          {isTauriHost ? (
            <iframe
              ref={iframeRef as React.RefObject<HTMLIFrameElement>}
              title="ip-check-frame"
              src={activeUrl}
              className="w-full h-full border-none bg-white"
            />
          ) : (
            <webview
              ref={iframeRef}
              id="ip-check-webview"
              src={activeUrl}
              className="w-full h-full border-none"
            />
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
