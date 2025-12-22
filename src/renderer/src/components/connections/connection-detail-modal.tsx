import { Modal, ModalContent, ModalHeader, ModalBody, Card, CardBody } from '@heroui/react'
import React from 'react'
import { calcTraffic } from '@renderer/utils/calc'
import dayjs from 'dayjs'
import { useAppConfig } from '@renderer/hooks/use-app-config'

interface Props {
  connection: ControllerConnectionDetail
  onClose: () => void
}

const ConnectionDetailModal: React.FC<Props> = (props) => {
  const { connection, onClose } = props
  const { appConfig: { disableAnimation = false } = {} } = useAppConfig()

  return (
    <Modal
      backdrop={disableAnimation ? 'transparent' : 'blur'}
      disableAnimation={disableAnimation}
      classNames={{ backdrop: 'top-[48px]' }}
      size="xl"
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent className="flag-emoji break-all">
        <ModalHeader className="flex justify-between items-center app-drag">
          <span>连接详情</span>
          <span 
            className="text-sm text-foreground-500 cursor-pointer hover:text-foreground app-nodrag"
            onClick={onClose}
          >
            关闭
          </span>
        </ModalHeader>
        <ModalBody className="gap-2 p-2">
          {/* 核心信息 */}
          <Card>
            <CardBody className="py-2">
              <div className="grid grid-cols-3 gap-2 text-sm text-center">
                <div>
                  <div className="text-foreground-500">时间</div>
                  <div>{dayjs(connection.start).fromNow()}</div>
                </div>
                <div>
                  <div className="text-foreground-500">类型</div>
                  <div>{connection.metadata.type}({connection.metadata.network})</div>
                </div>
                <div>
                  <div className="text-foreground-500">规则</div>
                  <div className="truncate">{connection.rule || '未命中'}</div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* 流量 */}
          <Card>
            <CardBody className="py-2">
              <div className="grid grid-cols-4 gap-2 text-sm text-center">
                <div>
                  <div className="text-foreground-500">↑ 速度</div>
                  <div className="text-warning">{calcTraffic(connection.uploadSpeed || 0)}/s</div>
                </div>
                <div>
                  <div className="text-foreground-500">↓ 速度</div>
                  <div className="text-primary">{calcTraffic(connection.downloadSpeed || 0)}/s</div>
                </div>
                <div>
                  <div className="text-foreground-500">↑ 总量</div>
                  <div className="text-warning">{calcTraffic(connection.upload)}</div>
                </div>
                <div>
                  <div className="text-foreground-500">↓ 总量</div>
                  <div className="text-primary">{calcTraffic(connection.download)}</div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* 目标信息 */}
          <Card>
            <CardBody className="py-2">
              <div className="grid grid-cols-2 gap-2 text-sm text-center">
                {connection.metadata.host && (
                  <div className="col-span-2">
                    <div className="text-foreground-500">主机</div>
                    <div className="truncate">
                      {connection.metadata.host}
                      {connection.metadata.destinationPort && `:${connection.metadata.destinationPort}`}
                    </div>
                  </div>
                )}
                {connection.metadata.destinationGeoIP && connection.metadata.destinationGeoIP.length > 0 && (
                  <div className="col-span-2">
                    <div className="text-foreground-500">GeoIP</div>
                    <div>{connection.metadata.destinationGeoIP.join(', ')}</div>
                  </div>
                )}
                {connection.metadata.sourceIP && (
                  <div>
                    <div className="text-foreground-500">源地址</div>
                    <div className="truncate">
                      {connection.metadata.sourceIP}
                      {connection.metadata.sourcePort && `:${connection.metadata.sourcePort}`}
                    </div>
                  </div>
                )}
                {connection.metadata.destinationIP && (
                  <div>
                    <div className="text-foreground-500">目标地址</div>
                    <div className="truncate">
                      {connection.metadata.destinationIP}
                      {connection.metadata.destinationPort && `:${connection.metadata.destinationPort}`}
                    </div>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          {/* 代理链 */}
          <Card>
            <CardBody className="py-2">
              <div className="flex items-center text-sm">
                <span className="text-foreground-500 w-12 shrink-0">代理链</span>
                <span className="truncate">{[...connection.chains].reverse().join(' → ')}</span>
              </div>
            </CardBody>
          </Card>

          {/* 更多信息 */}
          {(connection.metadata.sniffHost || connection.metadata.inboundName) && (
            <Card>
              <CardBody className="py-2">
                <div className="flex flex-col gap-1 text-sm">
                  {connection.metadata.inboundName && (
                    <div className="flex items-center">
                      <span className="text-foreground-500 w-16 shrink-0">入站名称</span>
                      <span>{connection.metadata.inboundName}</span>
                    </div>
                  )}
                  {connection.metadata.sniffHost && (
                    <div className="flex items-center">
                      <span className="text-foreground-500 w-16 shrink-0">嗅探主机</span>
                      <span className="truncate">{connection.metadata.sniffHost}</span>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          )}

          {/* 进程信息 */}
          {connection.metadata.process && connection.metadata.type !== 'Inner' && (
            <Card>
              <CardBody className="py-2">
                <div className="flex flex-col gap-1 text-sm">
                  <div className="flex items-center">
                    <span className="text-foreground-500 w-10 shrink-0">进程</span>
                    <span>{connection.metadata.process}</span>
                  </div>
                  {connection.metadata.processPath && (
                    <div className="flex items-center">
                      <span className="text-foreground-500 w-10 shrink-0">路径</span>
                      <span className="truncate">{connection.metadata.processPath}</span>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default ConnectionDetailModal
