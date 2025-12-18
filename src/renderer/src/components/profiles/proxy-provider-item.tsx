import { Button, Card, CardBody, Chip } from '@heroui/react'
import { IoMdRefresh } from 'react-icons/io'
import { CgLoadbarDoc } from 'react-icons/cg'
import { MdEditDocument } from 'react-icons/md'
import dayjs from 'dayjs'
import React from 'react'
import { calcTraffic } from '@renderer/utils/calc'

interface Props {
  provider: ControllerProxyProviderDetail
  index: number
  updating: boolean
  onUpdate: () => void
  onView: () => void
}

const ProxyProviderItem: React.FC<Props> = ({ provider, index, updating, onUpdate, onView }) => {
  return (
    <div className={`w-full px-2 pb-1 ${index === 0 ? 'pt-2' : ''}`}>
      <Card className="hover:bg-primary/30 transition-all duration-200">
        <CardBody className="w-full py-2">
          <div className="flex items-center gap-2">
            {/* 序号 */}
            <span className="text-foreground-400 text-sm w-5 flex-shrink-0">
              {index + 1}
            </span>
            {/* 名称 */}
            <span className="text-ellipsis whitespace-nowrap overflow-hidden">
              {provider.name}
            </span>
            {/* 代理数量 */}
            <Chip size="sm">{provider.proxies?.length || 0}</Chip>
            {/* 流量信息 */}
            {provider.subscriptionInfo && (
              <span className="text-foreground-400 text-sm flex-shrink-0">
                {calcTraffic(provider.subscriptionInfo.Upload + provider.subscriptionInfo.Download)} / {calcTraffic(provider.subscriptionInfo.Total)}
              </span>
            )}
            {/* 右侧信息 */}
            <div className="ml-auto flex items-center gap-2 flex-shrink-0">
              {provider.subscriptionInfo?.Expire && (
                <span className="text-foreground-400 text-sm">
                  {dayjs.unix(provider.subscriptionInfo.Expire).format('YYYY-MM-DD')}
                </span>
              )}
              <span className="text-foreground-400 text-sm">
                {dayjs(provider.updatedAt).fromNow()}
              </span>
              <Button
                isIconOnly
                title={provider.vehicleType === 'File' ? '编辑' : '查看'}
                size="sm"
                onPress={onView}
              >
                {provider.vehicleType === 'File' ? (
                  <MdEditDocument className="text-lg" />
                ) : (
                  <CgLoadbarDoc className="text-lg" />
                )}
              </Button>
              <Button
                isIconOnly
                title="更新"
                size="sm"
                onPress={onUpdate}
              >
                <IoMdRefresh className={`text-lg ${updating ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

export default ProxyProviderItem
