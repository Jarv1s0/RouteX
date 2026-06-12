import { useEffect, useRef, useState } from 'react'
import MihomoIcon from './components/base/mihomo-icon'
import { calcTraffic } from './utils/calc'
import { showContextMenu, triggerMainWindow } from './utils/window-ipc'
import { useAppConfig } from './hooks/use-app-config'
import { useControledMihomoConfig } from './hooks/use-controled-mihomo-config'
import { subscribeDesktopTraffic } from './utils/mihomo-ipc'

const FLOATING_TRAFFIC_VISUAL_INTERVAL_MS = 1000

function getSpinSpeed(totalTraffic: number): number {
  if (totalTraffic === 0) return 0
  if (totalTraffic < 1024) return 2
  if (totalTraffic < 1024 * 1024) return 3
  if (totalTraffic < 1024 * 1024 * 1024) return 4
  return 5
}

const FloatingApp: React.FC = () => {
  const { appConfig } = useAppConfig()
  const { controledMihomoConfig } = useControledMihomoConfig()
  const { sysProxy, spinFloatingIcon = true } = appConfig || {}
  const { tun } = controledMihomoConfig || {}
  const sysProxyEnabled = sysProxy?.enable
  const tunEnabled = tun?.enable

  const [traffic, setTraffic] = useState({ upload: 0, download: 0 })
  const lastVisualUpdateAtRef = useRef(0)
  const lastTrafficRef = useRef({ upload: 0, download: 0 })

  const spinSpeed = getSpinSpeed(traffic.upload + traffic.download)
  const spinDuration = spinSpeed > 0 ? `${360 / (spinSpeed * 60)}s` : undefined

  useEffect(() => {
    return subscribeDesktopTraffic((info) => {
      const now = Date.now()
      if (now - lastVisualUpdateAtRef.current < FLOATING_TRAFFIC_VISUAL_INTERVAL_MS) {
        return
      }

      const nextTraffic = { upload: info.up, download: info.down }
      if (
        nextTraffic.upload === lastTrafficRef.current.upload &&
        nextTraffic.download === lastTrafficRef.current.download
      ) {
        return
      }

      lastVisualUpdateAtRef.current = now
      lastTrafficRef.current = nextTraffic
      setTraffic(nextTraffic)
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
              spinFloatingIcon && spinDuration
                ? {
                    animationDuration: spinDuration
                  }
                : {}
            }
            className={`app-nodrag floating-thumb ${spinFloatingIcon && spinDuration ? 'is-spinning' : ''} ${tunEnabled ? 'is-tun' : sysProxyEnabled ? 'is-proxy' : 'is-default'}`}
          >
            <MihomoIcon className="floating-icon" />
          </div>
        </div>
        <div className="floating-speed">
          <div className="floating-speed-inner">
            <h2 className="floating-text">{calcTraffic(traffic.upload)}/s</h2>
            <h2 className="floating-text">{calcTraffic(traffic.download)}/s</h2>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FloatingApp
