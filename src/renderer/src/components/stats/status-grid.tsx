import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardBody } from '@heroui/react'
import { IoTime, IoSwapHorizontal, IoServer, IoGlobe, IoTimer } from 'react-icons/io5'
import { useConnections } from '@renderer/hooks/use-connections'
import { calcTraffic } from '@renderer/utils/calc'
import { getAppUptime, testDNSLatency, testConnectivity } from '@renderer/utils/ipc'
import { CARD_STYLES } from '@renderer/utils/card-styles'

const StatusGrid: React.FC = () => {
  const [uptime, setUptime] = useState<string>('00:00:00')
  const [dnsLatency, setDnsLatency] = useState<number>(-1)
  const [networkLatency, setNetworkLatency] = useState<number>(-1)
  
  const { connectionCount } = useConnections()
  const [memory, setMemory] = useState(0)
  const memoryUsage = useMemo(() => calcTraffic(memory), [memory])

  useEffect(() => {
    let startTime: number | null = null
    
    // Initial fetch
    getAppUptime().then(seconds => {
      startTime = Date.now() - (seconds * 1000)
    }).catch(() => {
      startTime = Date.now()
    })

    const updateStats = async () => {
      // DNS Latency
      try {
        const latency = await testDNSLatency('www.bing.com')
        setDnsLatency(latency)
      } catch {
        setDnsLatency(-1)
      }

      // Network Latency
      try {
        const res = await testConnectivity('http://www.gstatic.com/generate_204', 2000)
        setNetworkLatency(res.latency)
      } catch {
        setNetworkLatency(-1)
      }
    }

    const interval = setInterval(() => {
      // 运行时间逻辑
      if (startTime) {
        const now = Date.now()
        const diff = Math.floor((now - startTime) / 1000)
        const days = Math.floor(diff / 86400)
        const hours = Math.floor((diff % 86400) / 3600)
        const minutes = Math.floor((diff % 3600) / 60)
        const secs = diff % 60
        let timeStr = ''
        if (days > 0) timeStr += `${days}天 `
        timeStr += `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        setUptime(timeStr)
      }
    }, 1000)

    const onMemoryUpdate = (_e: unknown, info: ControllerMemory) => {
      setMemory(info.inuse)
    }
    window.electron.ipcRenderer.on('mihomoMemory', onMemoryUpdate)

    const pollInterval = setInterval(updateStats, 10000) // 10s 更新一次网络延迟
    updateStats()

    return () => {
      clearInterval(interval)
      clearInterval(pollInterval)
      window.electron.ipcRenderer.removeListener('mihomoMemory', onMemoryUpdate)
    }
  }, [])

  const stats = [
    {
      label: '运行时间',
      value: uptime || '00:00:00',
      icon: IoTime,
      iconClass: 'bg-cyan-500/10 text-cyan-500',
      valueClass: 'text-cyan-500 font-mono tracking-tight'
    },
    {
      label: '连接数',
      value: connectionCount ?? 0,
      icon: IoSwapHorizontal,
      iconClass: 'bg-purple-500/10 text-purple-500',
      valueClass: 'text-purple-500 font-mono tracking-tight'
    },
    {
      label: '内存占用',
      value: memoryUsage || '0 B',
      icon: IoServer,
      iconClass: 'bg-emerald-500/10 text-emerald-500',
      valueClass: 'text-emerald-500 font-mono tracking-tight'
    },
    {
      label: '网络延迟',
      value: (networkLatency ?? -1) === -1 ? '--' : networkLatency === 0 ? 'TIMEOUT' : `${networkLatency}ms`,
      icon: IoGlobe,
      iconClass: 'bg-amber-500/10 text-amber-500',
      valueClass: ((networkLatency ?? -1) === -1 ? 'text-default-400' : 
                  networkLatency === 0 ? 'text-rose-500' : 
                  networkLatency < 200 ? 'text-emerald-500' : 
                  networkLatency < 500 ? 'text-amber-500' : 'text-rose-500') + ' font-mono tracking-tight'
    },
    {
      label: 'DNS 延迟',
      value: (dnsLatency ?? -1) >= 0 ? (dnsLatency === 0 ? '<1ms' : `${dnsLatency}ms`) : 'TIMEOUT',
      icon: IoTimer,
      iconClass: 'bg-rose-500/10 text-rose-500',
      valueClass: ((dnsLatency ?? -1) < 0 ? 'text-rose-500' :
                  dnsLatency < 50 ? 'text-emerald-500' : 
                  dnsLatency < 100 ? 'text-amber-500' : 'text-rose-500') + ' font-mono tracking-tight'
    }
  ]

  return (
    <Card className={`${CARD_STYLES.BASE} ${CARD_STYLES.INACTIVE} hover:!scale-100 !cursor-default w-full`}>
      <CardBody className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:divide-x divide-default-100/50">
          {stats.map((stat, index) => (
            <div key={stat.label} className={`flex flex-col items-center justify-center gap-2 ${index > 0 ? 'md:pl-4' : ''}`}>
              <div className="flex items-center gap-2 mb-1">
                <div className={`p-1.5 rounded-lg ${stat.iconClass}`}>
                  <stat.icon className="text-sm" />
                </div>
                <span className="text-xs font-medium text-foreground-500">{stat.label}</span>
              </div>
              <span className={`text-xl font-bold ${stat.valueClass} truncate max-w-full`}>
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}

export default StatusGrid
