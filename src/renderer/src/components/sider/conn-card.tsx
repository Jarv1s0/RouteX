import { Button, Card, CardBody, Tooltip } from '@heroui/react'
import { LuCircleArrowDown, LuCircleArrowUp, LuPlug } from 'react-icons/lu'
import { useLocation } from 'react-router-dom'
import { calcTraffic } from '@renderer/utils/calc'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import React, { useEffect, useState, useRef } from 'react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { SEND, sendIpc } from '@renderer/utils/ipc-channels'
import { getIconDataURL } from '@renderer/utils/resource-ipc'
import { platform } from '@renderer/utils/init'
import { navigateSidebarRoute } from '@renderer/routes'
import { useConnectionsStore } from '@renderer/store/use-connections-store'
import { subscribeDesktopTraffic } from '@renderer/utils/mihomo-ipc'
import TrafficChart from './traffic-chart'

let currentUpload: number | undefined = undefined
let currentDownload: number | undefined = undefined
let hasShowTraffic = false
let drawing = false
let trayIconBase64Promise: Promise<string> | null = null

interface Props {
  iconOnly?: boolean
}

const ConnCard: React.FC<Props> = (props) => {
  const { iconOnly } = props
  const { appConfig } = useAppConfig()
  const {
    showTraffic = false
  } = appConfig || {}
  const showTrafficRef = useRef(showTraffic)
  showTrafficRef.current = showTraffic

  const location = useLocation()
  const match = location.pathname.includes('/connections')
  const handleNavigate = (): void => {
    navigateSidebarRoute('/connections')
  }

  const [upload, setUpload] = useState(0)
  const [download, setDownload] = useState(0)
  const lastVisualUpdateAtRef = useRef(0)
  const activeConnections = useConnectionsStore((state) => state.activeConnections)
  
  const [trafficData, setTrafficData] = useState(() =>
    Array(16)
      .fill(0)
      .map((_, i) => ({ upload: 0, download: 0, index: i }))
  )
  const isWindowFocusedRef = useRef(!document.hidden)

  useEffect(() => {
    if (activeConnections.length === 0) {
      return
    }

    const nextUpload = activeConnections.reduce(
      (total, connection) => total + (connection.uploadSpeed || 0),
      0
    )
    const nextDownload = activeConnections.reduce(
      (total, connection) => total + (connection.downloadSpeed || 0),
      0
    )

    setUpload(nextUpload)
    setDownload(nextDownload)

    if (isWindowFocusedRef.current) {
      setTrafficData((prev) => {
        const newData = [...prev]
        newData.shift()
        newData.push({ upload: nextUpload, download: nextDownload, index: Date.now() })
        return newData
      })
    }
  }, [activeConnections])

  // 监听窗口焦点状态
  useEffect(() => {
    const handleVisibilityChange = (): void => {
      isWindowFocusedRef.current = !document.hidden
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return (): void => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    const handleTraffic = async (info: ControllerTraffic): Promise<void> => {
      const now = Date.now()
      if (now - lastVisualUpdateAtRef.current < 250) {
        return
      }
      lastVisualUpdateAtRef.current = now

      setUpload(info.up)
      setDownload(info.down)

      // 只有窗口可见时才更新图表（性能优化）
      if (isWindowFocusedRef.current) {
        setTrafficData((prev) => {
          const newData = [...prev]
          newData.shift()
          newData.push({ upload: info.up, download: info.down, index: Date.now() })
          return newData
        })
      }

      if (platform === 'darwin' && showTrafficRef.current) {
        if (drawing) return
        drawing = true
        try {
          await drawSvg(info.up, info.down)
          hasShowTraffic = true
        } catch {
          // ignore
        } finally {
          drawing = false
        }
      } else {
        if (!hasShowTraffic) return
        sendIpc(SEND.trayIconUpdate, await getTrayIconBase64())
        hasShowTraffic = false
      }
    }

    return subscribeDesktopTraffic((info) => {
      void handleTraffic(info)
    })
  }, [])

  if (iconOnly) {
    return (
      <div className={`flex justify-center`}>
        <Tooltip content="连接" placement="right">
          <Button
            size="sm"
            isIconOnly
            color={match ? 'primary' : 'default'}
            variant={match ? 'solid' : 'light'}
            onPress={handleNavigate}
          >
            <LuPlug className="text-[16px]" />
          </Button>
        </Tooltip>
      </div>
    )
  }

  return (
    <div className={`conn-card`}>
      <Card
        fullWidth
        isPressable
        onPress={handleNavigate}
        className={`
          ${CARD_STYLES.BASE}
          ${match ? CARD_STYLES.ACTIVE : CARD_STYLES.INACTIVE}
          cursor-pointer
        `}
      >
        <CardBody className="py-3 px-5 h-[90px] flex flex-col justify-between relative overflow-hidden z-10 w-full">
          {/* Traffic Chart Layer (Pushed to bottom) */}
          <div className="absolute left-0 right-0 bottom-0 top-[20px] z-0 opacity-50 pointer-events-none">
              <TrafficChart data={trafficData} isActive={match} />
          </div>
          
          <div className="flex justify-between items-start relative z-10">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                <LuPlug className={`text-[16px] transition-colors text-foreground/70 dark:text-foreground/60`} />
              </span>
              <h3 className={`text-sm font-semibold text-foreground dark:text-foreground/90`}>连接</h3>
            </div>
          </div>
          
          <div className="flex justify-between items-end relative z-10 mt-auto">
             <div className="flex items-center justify-between w-full">
               {/* Upload */}
               <div className="flex items-center gap-1.5">
                   <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                     <LuCircleArrowUp className={`text-[12px] text-cyan-500 dark:text-cyan-400`} />
                   </span>
                   <div className="flex items-baseline gap-0.5">
                     <span className={`text-md font-black tracking-tight leading-none text-cyan-500 dark:text-cyan-400`}>
                       {calcTraffic(upload).replace(/[A-Za-z]/g, '')}
                     </span>
                     <span className={`text-[10px] font-bold uppercase leading-none text-cyan-600/60 dark:text-cyan-400/60`}>
                       {calcTraffic(upload).replace(/[^A-Za-z]/g, '')}/s
                     </span>
                   </div>
               </div>
               
               {/* Download */}
               <div className="flex items-center gap-1.5">
                   <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                     <LuCircleArrowDown className={`text-[12px] text-purple-500 dark:text-purple-400`} />
                   </span>
                   <div className="flex items-baseline gap-0.5">
                     <span className={`text-md font-black tracking-tight leading-none text-purple-500 dark:text-purple-400`}>
                       {calcTraffic(download).replace(/[A-Za-z]/g, '')}
                     </span>
                     <span className={`text-[10px] font-bold uppercase leading-none text-purple-600/60 dark:text-purple-400/60`}>
                       {calcTraffic(download).replace(/[^A-Za-z]/g, '')}/s
                     </span>
                   </div>
               </div>
             </div>
          </div>
        </CardBody>
        
      </Card>
    </div>
  )
}

export default React.memo(ConnCard, (prevProps, nextProps) => {
  return prevProps.iconOnly === nextProps.iconOnly
})

async function getTrayIconBase64(): Promise<string> {
  if (!trayIconBase64Promise) {
    trayIconBase64Promise = getIconDataURL('mihomo')
  }

  return await trayIconBase64Promise
}

const drawSvg = async (upload: number, download: number): Promise<void> => {
  if (upload === currentUpload && download === currentDownload) return
  currentUpload = upload
  currentDownload = download
  const trayIconBase64 = await getTrayIconBase64()
  const svg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 36"><image height="36" width="36" href="${trayIconBase64}"/><text x="140" y="15" font-size="18" font-family="PingFang SC" font-weight="bold" text-anchor="end">${calcTraffic(upload)}/s</text><text x="140" y="34" font-size="18" font-family="PingFang SC" font-weight="bold" text-anchor="end">${calcTraffic(download)}/s</text></svg>`
  const image = await loadImage(svg)
  sendIpc(SEND.trayIconUpdate, image)
}

const loadImage = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = (): void => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      canvas.width = 156
      canvas.height = 36
      ctx?.drawImage(img, 0, 0)
      const png = canvas.toDataURL('image/png')
      resolve(png)
    }
    img.onerror = (): void => {
      reject()
    }
    img.src = url
  })
}
