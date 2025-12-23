import { Modal, ModalContent, ModalHeader, ModalBody } from '@heroui/react'
import React, { useMemo } from 'react'
import { calcTraffic } from '@renderer/utils/calc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useGroups } from '@renderer/hooks/use-groups'

interface Props {
  connection: ControllerConnectionDetail
  onClose: () => void
}

// JSON 语法高亮渲染
const JsonHighlight: React.FC<{ data: object }> = ({ data }) => {
  const renderValue = (value: unknown, indent: number = 0): React.ReactNode => {
    const indentStr = '  '.repeat(indent)
    
    if (value === null) {
      return <span className="text-orange-400">null</span>
    }
    if (typeof value === 'boolean') {
      return <span className="text-orange-400">{value.toString()}</span>
    }
    if (typeof value === 'number') {
      return <span className="text-cyan-400">{value}</span>
    }
    if (typeof value === 'string') {
      return <span className="text-teal-600 dark:text-teal-400">&quot;{value}&quot;</span>
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return <span>[]</span>
      return (
        <>
          {'[\n'}
          {value.map((item, i) => (
            <span key={i}>
              {indentStr}  {renderValue(item, indent + 1)}
              {i < value.length - 1 ? ',' : ''}
              {'\n'}
            </span>
          ))}
          {indentStr}{']'}
        </>
      )
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value)
      if (entries.length === 0) return <span>{'{}'}</span>
      return (
        <>
          {'{\n'}
          {entries.map(([key, val], i) => (
            <span key={key}>
              {indentStr}  <span className="text-foreground-500">&quot;{key}&quot;</span>: {renderValue(val, indent + 1)}
              {i < entries.length - 1 ? ',' : ''}
              {'\n'}
            </span>
          ))}
          {indentStr}{'}'}
        </>
      )
    }
    return String(value)
  }

  return (
    <pre className="text-sm font-mono whitespace-pre overflow-x-auto">
      {renderValue(data)}
    </pre>
  )
}

// 获取节点延迟颜色
const getDelayColor = (proxy: ControllerProxiesDetail | ControllerGroupDetail | undefined): string => {
  if (!proxy?.history || proxy.history.length === 0) return 'bg-zinc-400'
  const delay = proxy.history[proxy.history.length - 1].delay
  if (delay === 0) return 'bg-red-500'
  if (delay < 200) return 'bg-emerald-500'
  if (delay < 500) return 'bg-amber-400'
  return 'bg-red-500'
}

const ConnectionDetailModal: React.FC<Props> = (props) => {
  const { connection, onClose } = props
  const { appConfig: { disableAnimation = false } = {} } = useAppConfig()
  const { groups = [] } = useGroups()

  // 构建显示的 JSON 数据（中文键名）
  const jsonData = useMemo(() => ({
    元数据: {
      网络协议: connection.metadata.network,
      连接类型: connection.metadata.type,
      源IP: connection.metadata.sourceIP || '',
      目标IP: connection.metadata.destinationIP || '',
      源GeoIP: connection.metadata.sourceGeoIP || null,
      目标GeoIP: connection.metadata.destinationGeoIP || null,
      源IPASN: connection.metadata.sourceIPASN || '',
      目标IPASN: connection.metadata.destinationIPASN || '',
      源端口: connection.metadata.sourcePort || '0',
      目标端口: connection.metadata.destinationPort || '',
      入站IP: connection.metadata.inboundIP || '',
      入站端口: connection.metadata.inboundPort || '0',
      入站名称: connection.metadata.inboundName || '',
      入站用户: connection.metadata.inboundUser || '',
      主机: connection.metadata.host || '',
      DNS模式: connection.metadata.dnsMode || 'normal',
      用户ID: connection.metadata.uid || 0,
      进程名: connection.metadata.process || '',
      进程路径: connection.metadata.processPath || '',
      特殊代理: connection.metadata.specialProxy || '',
      特殊规则: connection.metadata.specialRules || '',
      远程目标: connection.metadata.remoteDestination || '',
      DSCP: connection.metadata.dscp || 0,
      嗅探主机: connection.metadata.sniffHost || ''
    },
    上传流量: connection.upload,
    下载流量: connection.download,
    开始时间: connection.start,
    代理链: connection.chains,
    匹配规则: connection.rule || '',
    规则载荷: connection.rulePayload || '',
    下载速度: connection.downloadSpeed || 0,
    上传速度: connection.uploadSpeed || 0
  }), [connection])

  // 查找代理链中的组信息
  const chainGroups = useMemo(() => {
    return connection.chains.map(chainName => {
      const group = groups.find(g => g.name === chainName)
      return { name: chainName, group }
    }).reverse()
  }, [connection.chains, groups])

  // 获取当前节点的延迟
  const getCurrentDelay = (group: ControllerMixedGroup | undefined): number => {
    if (!group) return -1
    const current = group.all?.find((p) => p.name === group.now)
    if (!current?.history?.length) return -1
    return current.history[current.history.length - 1].delay
  }

  return (
    <Modal
      backdrop={disableAnimation ? 'transparent' : 'blur'}
      disableAnimation={disableAnimation}
      classNames={{ backdrop: 'top-[48px]' }}
      size="4xl"
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent className="flag-emoji">
        <ModalHeader className="flex justify-between items-center app-drag">
          <span>连接详情</span>
          <span 
            className="text-sm text-foreground-500 cursor-pointer hover:text-foreground app-nodrag"
            onClick={onClose}
          >
            ✕
          </span>
        </ModalHeader>
        <ModalBody className="p-4">
          <div className="flex gap-4 h-[500px]">
            {/* 左侧：JSON 数据 */}
            <div className="flex-1 overflow-auto bg-content2 rounded-lg p-3">
              <JsonHighlight data={jsonData} />
            </div>
            
            {/* 右侧：代理链信息 */}
            <div className="w-[280px] flex flex-col gap-4">
              {chainGroups.map(({ name, group }) => {
                // 如果不是代理组，跳过（最终节点已经在上一个组里显示了）
                if (!group) {
                  return null
                }

                const currentDelay = getCurrentDelay(group)
                const delayColor = currentDelay === -1 ? 'text-default-400' : currentDelay === 0 ? 'text-danger' : currentDelay < 200 ? 'text-success' : currentDelay < 500 ? 'text-warning' : 'text-danger'
                const availableCount = group.all.filter(p => {
                  if (!p.history || p.history.length === 0) return false
                  return p.history[p.history.length - 1].delay > 0
                }).length

                return (
                  <div key={name} className="bg-content2 rounded-lg p-3">
                    <div className="flex flex-wrap gap-1 mb-3">
                      {group.all.slice(0, 20).map((proxy, i) => (
                        <div
                          key={i}
                          className={`w-3 h-3 rounded-full ${getDelayColor(proxy)} ${proxy.name === group.now ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                          title={`${proxy.name}: ${proxy.history?.length ? (proxy.history[proxy.history.length - 1].delay || '超时') + 'ms' : '未测试'}`}
                        />
                      ))}
                      {group.all.length > 20 && (
                        <span className="text-xs text-foreground-400">+{group.all.length - 20}</span>
                      )}
                    </div>
                    
                    {/* 组信息 */}
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {group.icon && (
                          <img
                            className="w-5 h-5 object-contain"
                            src={group.icon}
                            alt=""
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        )}
                        <span className="font-medium">{group.name}</span>
                        <span className="text-xs text-foreground-400">: {group.type} ({availableCount}/{group.all.length})</span>
                      </div>
                      <span className={`text-sm font-medium ${delayColor}`}>
                        {currentDelay === -1 ? '--' : currentDelay === 0 ? '超时' : currentDelay}
                      </span>
                    </div>
                    
                    {/* 当前节点 */}
                    <div className="flex items-center justify-between text-sm text-foreground-500">
                      <div className="flex items-center gap-1">
                        <span>⊙</span>
                        <span className="flag-emoji">{group.now}</span>
                      </div>
                      <span className="text-foreground-400">
                        {calcTraffic(connection.downloadSpeed || 0)}/s
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default ConnectionDetailModal
