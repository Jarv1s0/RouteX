import { useEffect, useRef, useState } from 'react'
import MihomoIcon from './components/base/mihomo-icon'
import { calcTraffic } from './utils/calc'
import { showContextMenu, triggerMainWindow } from './utils/window-ipc'
import { useAppConfig } from './hooks/use-app-config'
import { useControledMihomoConfig } from './hooks/use-controled-mihomo-config'
import { subscribeDesktopTraffic } from './utils/mihomo-ipc'

const FLOATING_TRAFFIC_VISUAL_INTERVAL_MS = 1000
const FLOATING_TRAFFIC_SMOOTHING_WEIGHTS = [1, 2, 4] as const
const SLOWEST_SPIN_DURATION_SECONDS = 10
const FASTEST_SPIN_DURATION_SECONDS = 0.1

type FloatingTraffic = {
  upload: number
  download: number
}

export function smoothFloatingTraffic(samples: FloatingTraffic[]): FloatingTraffic {
  const recentSamples = samples.slice(-FLOATING_TRAFFIC_SMOOTHING_WEIGHTS.length)
  const weights = FLOATING_TRAFFIC_SMOOTHING_WEIGHTS.slice(-recentSamples.length)
  const totalWeight = weights.reduce((total, weight) => total + weight, 0)

  const smoothValue = (key: keyof FloatingTraffic): number => {
    if (recentSamples.at(-1)?.[key] === 0) {
      return 0
    }

    const weightedValue = recentSamples.reduce(
      (total, sample, index) => total + sample[key] * weights[index],
      0
    )

    return Math.round(weightedValue / totalWeight)
  }

  return {
    upload: smoothValue('upload'),
    download: smoothValue('download')
  }
}

export function getSpinDurationSeconds(totalTraffic: number): number {
  if (totalTraffic <= 0) {
    return SLOWEST_SPIN_DURATION_SECONDS
  }

  return Math.min(
    SLOWEST_SPIN_DURATION_SECONDS,
    Math.max(FASTEST_SPIN_DURATION_SECONDS, 409600 / totalTraffic)
  )
}

const FloatingApp: React.FC = () => {
  const { appConfig } = useAppConfig()
  const { controledMihomoConfig } = useControledMihomoConfig()
  const { sysProxy, spinFloatingIcon = false } = appConfig || {}
  const { tun } = controledMihomoConfig || {}
  const sysProxyEnabled = sysProxy?.enable
  const tunEnabled = tun?.enable

  const [traffic, setTraffic] = useState({ upload: 0, download: 0 })
  const lastVisualUpdateAtRef = useRef(0)
  const trafficSamplesRef = useRef<FloatingTraffic[]>([])

  const spinDuration = `${getSpinDurationSeconds(traffic.upload + traffic.download)}s`

  useEffect(() => {
    return subscribeDesktopTraffic((info) => {
      const now = Date.now()
      if (now - lastVisualUpdateAtRef.current < FLOATING_TRAFFIC_VISUAL_INTERVAL_MS) {
        return
      }

      const nextSample = { upload: info.up, download: info.down }
      trafficSamplesRef.current = [...trafficSamplesRef.current, nextSample].slice(
        -FLOATING_TRAFFIC_SMOOTHING_WEIGHTS.length
      )
      const nextTraffic = smoothFloatingTraffic(trafficSamplesRef.current)

      lastVisualUpdateAtRef.current = now
      setTraffic((currentTraffic) =>
        currentTraffic.upload === nextTraffic.upload &&
        currentTraffic.download === nextTraffic.download
          ? currentTraffic
          : nextTraffic
      )
    })
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
                    animationDuration: spinDuration
                  }
                : {}
            }
            className={`app-nodrag floating-thumb ${spinFloatingIcon ? 'is-spinning' : ''} ${tunEnabled ? 'is-tun' : sysProxyEnabled ? 'is-proxy' : 'is-default'}`}
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
