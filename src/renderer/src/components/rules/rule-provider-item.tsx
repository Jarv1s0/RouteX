import { Button, Card, CardBody, Chip } from '@heroui/react'
import { IoMdRefresh } from 'react-icons/io'
import { CgLoadbarDoc } from 'react-icons/cg'
import { MdEditDocument } from 'react-icons/md'
import dayjs from 'dayjs'
import React from 'react'

interface Props {
  provider: ControllerRuleProviderDetail
  index: number
  updating: boolean
  onUpdate: () => void
  onView: () => void
}

const RuleProviderItem: React.FC<Props> = ({ provider, index, updating, onUpdate, onView }) => {
  return (
    <div className={`w-full px-2 pb-1 ${index === 0 ? 'pt-2' : ''}`}>
      <Card 
        shadow="sm"
        className="border-1 border-divider hover:shadow-md hover:bg-primary/10 transition-all duration-200"
      >
        <CardBody className="w-full py-2 px-3">
          <div className="flex items-center gap-2">
            {/* 序号 */}
            <span className="text-foreground-400 text-xs w-6 flex-shrink-0 -mr-1">
              {index + 1}.
            </span>
            {/* 格式 */}
            <Chip size="sm" variant="flat" color="default" classNames={{ content: "text-xs" }}>
              {provider.format || 'InlineRule'}
            </Chip>
            {/* 名称 */}
            <span className="text-sm font-medium text-ellipsis whitespace-nowrap overflow-hidden">
              {provider.name}
            </span>
            {/* 规则数量 */}
            <Chip size="sm" variant="flat" color="default" classNames={{ content: "text-xs" }}>
              {provider.ruleCount}
            </Chip>
            {/* 右侧信息 */}
            <div className="ml-auto flex items-center gap-2 flex-shrink-0">
              <span className="text-foreground-400 text-xs">
                {provider.vehicleType}::{provider.behavior}
              </span>
              <span className="text-foreground-400 text-xs">
                {dayjs(provider.updatedAt).fromNow()}
              </span>
              {provider.format !== 'MrsRule' && provider.vehicleType !== 'Inline' && (
                <Button
                  isIconOnly
                  variant="light"
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
              )}
              <Button
                isIconOnly
                variant="light"
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

export default RuleProviderItem
