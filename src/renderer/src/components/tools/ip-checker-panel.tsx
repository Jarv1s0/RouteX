import React, { useState, useEffect, useCallback } from 'react'
import { Chip, Skeleton } from '@heroui/react'
import { IoGlobe, IoRefreshCircle, IoCopy } from 'react-icons/io5'
import { httpGet } from '@renderer/utils/ipc'

interface ProviderResult {
  ip: string
  location: string
  isp: string
  latency?: number
}

interface IpProvider {
  id: string
  name: string
  type: '国内' | '国际'
  iconClass: string
  check: () => Promise<ProviderResult>
}

const providers: IpProvider[] = [
  {
    id: 'ipip',
    name: 'IPIP.net',
    type: '国内',
    iconClass: 'bg-success/10 text-success',
    check: async () => {
      const start = Date.now()
      const res = await httpGet('https://myip.ipip.net/json', 5000)
      const parsed = JSON.parse(res.data)
      const data = parsed.data || {}
      return {
        ip: data.ip || '',
        location: (data.location || []).filter(Boolean).slice(0, 3).join(' '),
        isp: (data.location || []).length >= 4 ? data.location.slice(-1)[0] : '',
        latency: Date.now() - start
      }
    }
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    type: '国际',
    iconClass: 'bg-success/10 text-success',
    check: async () => {
      const start = Date.now()
      const res = await httpGet('https://1.1.1.1/cdn-cgi/trace', 5000)
      const lines = res.data.split('\n')
      const map: Record<string, string> = {}
      lines.forEach((l) => {
        const [k, v] = l.split('=')
        if (k) map[k] = v
      })
      return { 
        ip: map.ip || '', 
        location: map.loc || '', 
        isp: `${map.colo || ''} ${map.fl || ''}`,
        latency: Date.now() - start
      }
    }
  },
  {
    id: 'ipinfo',
    name: 'IPinfo.io',
    type: '国际',
    iconClass: 'bg-success/10 text-success',
    check: async () => {
      const start = Date.now()
      const res = await httpGet('https://ipinfo.io/json', 5000)
      const data = JSON.parse(res.data)
      return {
        ip: data.ip,
        location: [data.country, data.region, data.city].filter(Boolean).join(' '),
        isp: data.org,
        latency: Date.now() - start
      }
    }
  }
]

export interface IpCheckerPanelProps {
  showIp?: boolean
  onResultsChange?: (results: Record<string, ProviderResult>) => void
}

export const IpCheckerPanel: React.FC<IpCheckerPanelProps> = ({ showIp = true, onResultsChange }) => {
  const [providerResults, setProviderResults] = useState<Record<string, { status: 'loading' | 'success' | 'error', data?: ProviderResult, error?: string }>>({})

  const fetchProviders = useCallback(async () => {
    const initialStatus: Record<string, { status: 'loading' | 'success' | 'error' }> = {}
    providers.forEach(p => {
      initialStatus[p.id] = { status: 'loading' }
    })
    setProviderResults(initialStatus)

    providers.forEach(async (provider) => {
      try {
        const result = await provider.check()
        setProviderResults((prev) => ({
          ...prev,
          [provider.id]: { status: 'success', data: result }
        }))
      } catch (e) {
        setProviderResults((prev) => ({
          ...prev,
          [provider.id]: { status: 'error', error: e instanceof Error ? e.message : String(e) }
        }))
      }
    })
  }, [])

  useEffect(() => {
    fetchProviders()
  }, [fetchProviders])

  useEffect(() => {
    if (onResultsChange) {
      const results: Record<string, ProviderResult> = {}
      let hasData = false
      Object.entries(providerResults).forEach(([key, value]) => {
        if (value.status === 'success' && value.data) {
          results[key] = value.data
          hasData = true
        }
      })
      if (hasData) {
        onResultsChange(results)
      }
    }
  }, [providerResults, onResultsChange])

  return (
    <>
      {providers.map((provider) => {
        const state = providerResults[provider.id]
        return (
          <div key={provider.id} className="p-4 rounded-xl bg-default-50/50 border border-default-200/30 flex items-center justify-between gap-3 hover:bg-default-100/50 transition-colors h-[72px]">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={`p-2 rounded-lg shrink-0 ${provider.iconClass}`}>
                <IoGlobe className="text-xl" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="text-xs text-foreground-400 font-medium">{provider.name}</div>
                  <Chip size="sm" variant="flat" color={provider.type === '国内' ? 'primary' : 'success'} className="h-4 px-1 text-[9px]">
                    {provider.type}
                  </Chip>
                </div>
                
                {state?.status === 'loading' && (
                  <div className="space-y-1.5 mt-1">
                    <Skeleton className="h-3.5 w-3/4 rounded" />
                  </div>
                )}

                {state?.status === 'error' && (
                  <div className="flex items-center gap-1 text-xs text-danger mt-1 truncate" title={state.error}>
                    <IoRefreshCircle className="text-base cursor-pointer hover:text-danger-500" onClick={() => fetchProviders()} />
                    <span>检测失败</span>
                  </div>
                )}

                {state?.status === 'success' && state.data && (
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-bold font-mono tracking-wide select-all truncate">
                      {showIp ? state.data.ip : '•••• •••• •••• ••••'}
                    </div>
                    {showIp && (
                      <IoCopy 
                        className="text-foreground-400 hover:text-primary cursor-pointer transition-colors text-xs" 
                        onClick={() => navigator.clipboard.writeText(state.data!.ip)}
                        title="复制 IP"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 右侧归属地与延迟 */}
            <div className="flex flex-col items-end shrink-0 pl-2 border-l border-default-200/50 min-w-[120px]">
               {state?.status === 'loading' && (
                  <div className="space-y-1.5 w-full flex flex-col items-end">
                    <Skeleton className="h-3.5 w-3/4 rounded" />
                    <Skeleton className="h-2.5 w-1/2 rounded" />
                  </div>
               )}
               {state?.status === 'success' && state.data && (
                  <>
                    <div className="text-xs text-foreground-500 truncate max-w-[140px]" title={`${state.data.location} ${state.data.isp}`}>
                      {state.data.location || '未知'} {state.data.isp && `· ${state.data.isp}`}
                    </div>
                    <div className={state.data.latency && state.data.latency < 200 ? 'text-[11px] font-mono mt-0.5 text-success' : 'text-[11px] font-mono mt-0.5 text-warning'}>
                      {state.data.latency} ms
                    </div>
                  </>
               )}
            </div>
          </div>
        )
      })}
    </>
  )
}
