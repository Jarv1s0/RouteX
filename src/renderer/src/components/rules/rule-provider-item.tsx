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
    <div className="w-full px-2 pb-2">
      <Card 
        shadow="sm"
        radius="lg"
        className="bg-white/50 dark:bg-default-100/50 backdrop-blur-md hover:bg-white/80 dark:hover:bg-default-100/80 transition-all border border-transparent hover:border-default-200/50 shadow-sm"
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
              {provider.vehicleType !== 'Inline' && 
               provider.format?.toLowerCase() !== 'mrs' && 
               provider.format?.toLowerCase() !== 'mrsrule' && 
               !provider.name.toLowerCase().endsWith('.mrs') && (
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
