import { Button, Card, CardBody, Tooltip } from '@heroui/react'
import { LuCircleArrowDown, LuCircleArrowUp, LuPlug } from 'react-icons/lu'
import { useLocation, useNavigate } from 'react-router-dom'
import { calcTraffic } from '@renderer/utils/calc'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import React, { useEffect, useState, useRef } from 'react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { ON, SEND, onIpc, sendIpc } from '@renderer/utils/ipc-channels'
import { platform } from '@renderer/utils/init'
import TrafficChart from './traffic-chart'

let currentUpload: number | undefined = undefined
let currentDownload: number | undefined = undefined
let hasShowTraffic = false
let drawing = false

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
  const navigate = useNavigate()
  const match = location.pathname.includes('/connections')

  const [upload, setUpload] = useState(0)
  const [download, setDownload] = useState(0)
  
  const [trafficData, setTrafficData] = useState(() =>
    Array(16)
      .fill(0)
      .map((_, i) => ({ upload: 0, download: 0, index: i }))
  )
  const isWindowFocusedRef = useRef(!document.hidden)

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
    const handleTraffic = async (_e: unknown, info: ControllerTraffic): Promise<void> => {
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
        sendIpc(SEND.trayIconUpdate, trayIconBase64)
        hasShowTraffic = false
      }
    }

    return onIpc(ON.mihomoTraffic, handleTraffic)
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
            onPress={() => {
              navigate('/connections')
            }}
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
        onPress={() => navigate('/connections')}
        className={`
          ${CARD_STYLES.BASE}
          ${match ? CARD_STYLES.ACTIVE : CARD_STYLES.INACTIVE}
          cursor-pointer
        `}
      >
        <CardBody className="py-3 px-5 h-[100px] flex flex-col justify-between relative overflow-hidden z-10 w-full">
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

const drawSvg = async (upload: number, download: number): Promise<void> => {
  if (upload === currentUpload && download === currentDownload) return
  currentUpload = upload
  currentDownload = download
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

const trayIconBase64 = `data:image/png;base64,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Uk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAAJcEhZcwAAFiUAABYlAUlSJPAAAATuaVRYdFhNTDpjb20uYWRvYmUueG1wAAAAAAA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/PiA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJBZG9iZSBYTVAgQ29yZSA5LjEtYzAwMiA3OS5kYmEzZGEzLCAyMDIzLzEyLzEzLTA1OjA2OjQ5ICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgMjUuNiAoV2luZG93cykiIHhtcE1vZGlmeURhdGU9IjIwMjQtMDgtMjhUMjE6NTc6MzArMDg6MDAiIHhtcDpNZXRhZGF0YURhdGU9IjIwMjQtMDgtMjhUMjE6NTc6MzArMDg6MDAiIGRjOmZvcm1hdD0iaW1hZ2UvcG5nIiBwaG90b3Nob3A6Q29sb3JNb2RlPSIzIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjgwNzdmNWRmLWE4OGEtM2M0Ni1hODY5LTkxMDdjOWE2MGM4NCIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDo4MDc3ZjVkZi1hODhhLTNjNDYtYTg2OS05MTA3YzlhNjBjODQiIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo4MDc3ZjVkZi1hODhhLTNjNDYtYTg2OS05MTA3YzlhNjBjODQiPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjcmVhdGVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOjgwNzdmNWRmLWE4OGEtM2M0Ni1hODY5LTkxMDdjOWE2MGM4NCIgc3RFdnQ6d2hlbj0iMjAyNC0wOC0xNFQyMjoxODowMCswODowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIDI1LjYgKFdpbmRvd3MpIi8+IDwvcmRmOlNlcT4gPC94bXBNTTpIaXN0b3J5PiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/Pq87gmcAAAeOSURBVHic7dxrjFxlgQfwt9ldu7NAa6211AQK1AJaRES8kIhHIQZR10cUEqMhIr+IEzlARDBAPPQ1Sryg/BCNMQgToxg1xW+EiPRUlYuK+AEEKi4WaIFuW1hQ2a5X50x7Z2d6ZmZmt7sN/MhkzszMec95v/f9nveZ05qYmPBcljA62wIsNJ7zBIwNFmleLscovCeq12E4HIfxXfy0wJI5f2bSvDwak3ARHsbj+BfuxaO4t8CS+6kRAE/icCzAaPWaV/1OYBnmpXn5oyJL9gxjaoQ0L/di0a7CG/EoXsLurL3G8UecoQ1wO16BozADz8chWIT5WICX4wpcmOblozk/nWZL83IUK/BV/GOwkDNiDgdgGZbhYIUr9iTgi3ioyXNeisvw8TQvDwwI9rohzcsRIsYCvQPP6XD7+jwLBIwPrd4JR+DT+Eyalw/rSDIZQE3+H/Ep/FMg2R2h1WGNbI9hl/A0LsWVaV4e3uS+gSLNyzHxyF/EEbqXgyRJ/ZjBSfhwXFFp3aKkOoLvwLU4oeXtI+2LMgEjmHdx+AjWpXl5TK/394Q0LxfjY7hRjOlm/Ld9MRhHqYV34dtpXr58AOMdFNXk38W1Oie7DhkiE3wDvpfm5UmVSRPQ0rxchik+hrOwhzHViJQLBsLp+G5Sgn2FNC9fgE8FAobbfL0Tk4ddJlZqNb6Bd6V52c/oSSDNy5fgqzg/OLKBYaaCoWOxBudU4b9NrzukedlK83IFvoZ3N7nIT/cDBo1j8Elc0AcJld/4WmDj3wU3B6dbzMQRqDGOEEb2o12sxsx7+1fh3Z01Q3TQvzHNBgUEMYrTvPxGkSVbmFzh9maeaIfZpfI8XZztdKaDmwUBIgS7BEvTvLwRT4qIc1n1/91pXq7EEziRGk4tBsOmRQAMFBM7bSRYVojQVbi2V7Adb8BLho1h0CTYd8oskDOfF70oKwk8IrIqDwzTmt6yS8iwUc3DbxS9hP07RQbwPVEk/rvTlw7oxnZ8B+/Bh3FvB4MGXqKR7cCVRZbch5/gMrGCocYWXIcPFlmyocjS3+DBXghoaM/iNC+biyzZDZ/BRfidSDp2B/8SjtKAIkseryF/iMhPNGLXlNguDthaRJZsEgnTHwwViQb42zz1bhZZsh0oGbvBYNWgytKdpXn5aWEnPqhnI1If3IFriyxZ2+SefafEpoIssQAX40uBxagL9uPiXi9eM3KEj0WWbEvz8irh2mYRlCAktrvH5P9RtQQ9Yp8cLDAXl+X5toDfiUVFRt7W5rE9LWBcwEBrQZElo2le3iaKPhsfwoYgVT8rbPgTnyFgsQgQV4l8winBwbk+q0k6eOR4FawR6wRMsZkoO4IsORzn5XWwx6PZ6a6PWFWv2FFkyfb9vHSsBAeZ2ChBFRMfbHFfu4W3NFk8aQsyt12Dj8EEpm2EzJw/gx4VmUzvisxcRD/D3AljtQYnRdhuwD6uSruHegGjB6WPExE6kInXYGSsw7v2Bc20C3TLWZuA+ZzJKIxtASabxHAgM5q0/QHLi2ZUFfaICDrXGou41R4tEtn+w34o/7MIAo7taH/NWBQVRM2YW0TskH2wf92yTQRUbm1/cCBgbe4RNb2jKvsjY+S0XEx8VUTkbTG8DPa6jVlisk8LEnZii2iU3CQi0B5V193jX92qN0tD5aojRHa2UDBmrBBR7mbsxMZQ6+91yN1kX7JfIuRtU2zPFtwriKAn2L4x/2X1zH4E7PtwE8HahKgTWv1mHhO29mRRTZkviR6hYvJ9TeMUZVIh6WvA+2S2tkRd4Uqcl5/uXz0zuwMBC0bZIQKsB2MfoaTWAVvHWC1sLLLk4cDWCVfgbM3zeE8hI/9YmpeXN3jZ/xSEz+LveI6Hh7QdRNPE4eP8fV8h21ayNwFrsKTDYHWcqT6vWy78bQ2Pf4gi3MxvtmzVMcR5dwy1nAJ1As4Xne5h1QnNQzf1jRqQEUW2VvjZk+I2sfkH2/zm79YwlNnZ+a12wdHQIegqEZwVmsWcJ+epAn8ghKZ5uVrk/B7pX6SuqTdfaKyfLLKkfbr9bL2egDQvXxXFkZkEx+mXuCLIklk697lJ9A8tEI2TW7GeD6X1XdV1UfVwKq6v3l8pRgLnikfU2A9P290plO1popjqPbjL3L04jK8pP2H1oX8oZ97dDjS0qZz6NluEaw8W23qnmPRT1Mzuwq/wiwF5h52oE2MVjqwThVlsdyWfrT6E1buwn1+xphBQs7MdLULKh+NNwmVOBR89Wrjsl+HmItwex5BheKeqcsbZv21aipcLQlayT6Tswp313HeIOOBQtbckCUjz8kWCxdfhLWKlp4qE9ZC40k4RJmiE2I1s9oyMsvjaRBwnHLrzzDPwHHFkbsXNxRG5k70J2Ic/F67tHjHJDbhJTHqHWOW5AgEnoCijHduEF7+en810vQ2StBRZMtVTbheNRidFI/5XwVGDvtV9ooK1/SM5vNq8vBufE7f7TGEwt3Z/f1YdohmYm81sQfC/T8BsCzDb+B+YyC9dJcO5zQAAAABJRU5ErkJggg==`
