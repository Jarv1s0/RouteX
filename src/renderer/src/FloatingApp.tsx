import { useEffect, useMemo, useState } from 'react'
import MihomoIcon from './components/base/mihomo-icon'
import { calcTraffic } from './utils/calc'
import { showContextMenu, triggerMainWindow } from './utils/window-ipc'
import { useAppConfig } from './hooks/use-app-config'
import { useControledMihomoConfig } from './hooks/use-controled-mihomo-config'
import { subscribeDesktopTraffic } from './utils/mihomo-ipc'

const FloatingApp: React.FC = () => {
  const { appConfig } = useAppConfig()
  const { controledMihomoConfig } = useControledMihomoConfig()
  const { sysProxy, spinFloatingIcon = true } = appConfig || {}
  const { tun } = controledMihomoConfig || {}
  const sysProxyEnabled = sysProxy?.enable
  const tunEnabled = tun?.enable

  const [upload, setUpload] = useState(0)
  const [download, setDownload] = useState(0)

  // 根据总速率计算旋转速度
  const spinSpeed = useMemo(() => {
    const total = upload + download
    if (total === 0) return 0
    if (total < 1024) return 2
    if (total < 1024 * 1024) return 3
    if (total < 1024 * 1024 * 1024) return 4
    return 5
  }, [upload, download])

  const [rotation, setRotation] = useState(0)

  useEffect(() => {
    if (!spinFloatingIcon || spinSpeed <= 0) return

    let animationFrameId: number
    const animate = (): void => {
      setRotation((prev) => {
        if (prev === 360) {
          return 0
        }
        return prev + spinSpeed
      })
      animationFrameId = requestAnimationFrame(animate)
    }

    animationFrameId = requestAnimationFrame(animate)
    return (): void => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [spinSpeed, spinFloatingIcon])

  useEffect(() => {
    return subscribeDesktopTraffic((info) => {
      setUpload(info.up)
      setDownload(info.down)
    }, true)
  }, [])

  return (
    <div className="app-drag floating-root">
      <div className="floating-bg">
        <div className="floating-icon-wrap">
          <div
            onContextMenu={(e) => {
              e.preventDefault()
              showContextMenu()
            }}
            onClick={() => {
              triggerMainWindow()
            }}
            style={
              spinFloatingIcon
                ? {
                    transform: `rotate(${rotation}deg)`,
                    transition: 'transform 0.1s linear'
                  }
                : {}
            }
            className={`app-nodrag floating-thumb ${tunEnabled ? 'is-tun' : sysProxyEnabled ? 'is-proxy' : 'is-default'}`}
          >
            <MihomoIcon className="floating-icon" />
          </div>
        </div>
        <div className="floating-speed">
          <div className="floating-speed-inner">
            <h2 className="floating-text">{calcTraffic(upload)}/s</h2>
            <h2 className="floating-text">{calcTraffic(download)}/s</h2>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FloatingApp
