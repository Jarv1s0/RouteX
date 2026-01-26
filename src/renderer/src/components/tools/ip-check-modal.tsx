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
import { testRuleMatch, mihomoChangeProxy } from '@renderer/utils/ipc'
import { useGroups } from '@renderer/hooks/use-groups'
import { IoOpenOutline, IoReload } from 'react-icons/io5'

interface Props {
  isOpen: boolean
  onClose: () => void
}


export const IPCheckModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { groups = [], mutate } = useGroups()
  
  // Site Selection State
  const [targetUrl, setTargetUrl] = useState<string>('https://ping0.cc/')
  const [customUrl, setCustomUrl] = useState<string>('')
  const [isCustom, setIsCustom] = useState(false)
  const [activeUrl, setActiveUrl] = useState<string>('https://ping0.cc/')

  // Route Control State
  const [autoMatchGroup, setAutoMatchGroup] = useState<string>('') // The group matched by rule
  const [selectedGroup, setSelectedGroup] = useState<string>('') // The group user is currently controlling
  const [loadingMatch, setLoadingMatch] = useState(false)
  const iframeRef = useRef<any>(null)

  const sites = [
    { name: 'Ping0 (IP纯净度)', url: 'https://ping0.cc/' },
    { name: 'IP.SB (IP信息)', url: 'https://ip.sb/' },
    { name: 'Whoer (匿名度)', url: 'https://whoer.net/' },
    { name: 'IP138 (国内查询)', url: 'https://www.ip138.com/' },
    { name: '自定义网址', url: 'custom' },
  ]

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
        } catch { return }

        testRuleMatch(domain)
            .then((res) => {
            if (res && res.proxy) {
                setAutoMatchGroup(res.proxy)
                // If user hasn't manually selected a group yet (or just opened), auto-switch to matched
                setSelectedGroup(res.proxy)
            }
            })
            .finally(() => setLoadingMatch(false))
      } catch (e) {
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
    // Refresh iframe
    if (iframeRef.current) {
        // eslint-disable-next-line no-self-assign
        iframeRef.current.src = iframeRef.current.src
    }
  }

  const reloadIframe = () => {
    if (iframeRef.current) {
        // eslint-disable-next-line no-self-assign
        iframeRef.current.src = iframeRef.current.src
    }
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
      classNames={{
        body: "p-0 overflow-hidden",
        base: "h-[90vh]"
      }}
    >
      <ModalContent>
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
                        placeholder="输入网址，如 https://google.com"
                        value={customUrl}
                        onValueChange={handleCustomUrlSubmit}
                        className="flex-1 max-w-sm"
                    />
                )}
                
                <div className="flex items-center gap-2">
                    <Button 
                        size="sm" 
                        variant="flat" 
                        onPress={reloadIframe}
                        startContent={<IoReload />}
                    >
                        刷新
                    </Button>
                    <Button 
                        size="sm" 
                        color="primary" 
                        variant="flat" 
                        onPress={() => window.open(activeUrl, '_blank')}
                        startContent={<IoOpenOutline />}
                    >
                        浏览器打开
                    </Button>
                </div>
            </div>
          </div>
          
          {/* Control Bar: Proxy Group & Node Selector */}
          <div className="flex items-center gap-4 text-small font-normal bg-default-50 p-2.5 rounded-xl border border-default-100">
            
            {/* 1. Group Selector */}
            <div className="flex items-center gap-2 min-w-[200px]">
                <span className="text-foreground-500 shrink-0">代理组:</span>
                <Select
                    size="sm"
                    aria-label="Select Proxy Group"
                    selectedKeys={selectedGroup ? [selectedGroup] : []}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                    className="flex-1"
                    disallowEmptySelection
                >
                    {groups.filter(g => g.type === 'Selector' || g.name === 'GLOBAL').map((g) => (
                        <SelectItem key={g.name} textValue={g.name}>
                            {g.name} {autoMatchGroup === g.name ? '(自动匹配)' : ''}
                        </SelectItem>
                    ))}
                </Select>
            </div>

            {/* 2. Node Selector (if applicable) */}
            {currentGroupDetail && isSelectable ? (
                <div className="flex items-center gap-2 flex-1 border-l border-default-200 pl-4">
                    <span className="text-foreground-500 shrink-0">选择节点:</span>
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
                    <span>当前节点: {currentNode || '无'}</span>
                    <span className="text-xs text-warning ml-1">(此组不可手动切换)</span>
                </div>
            )}

            {/* Loading Indicator */}
            {loadingMatch && (
                <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 px-2 py-1 rounded-lg">
                    <Spinner size="sm" color="current" />
                    <span>分析路由中...</span>
                </div>
            )}
          </div>
        </ModalHeader>
        <ModalBody>
           {/* @ts-ignore: webview tag is available in Electron with webviewTag: true */}
           <webview 
                ref={iframeRef}
                id="ip-check-webview"
                src={activeUrl}
                className="w-full h-full border-none"
                // Webview handles permissions differently, sandbox attribute is for iframes
                // We likely don't need manual sandbox prop for webview as it's isolated by default
                // allowpopups might be needed if sites open popups
           />
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
