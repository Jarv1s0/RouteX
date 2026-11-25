import { Card, CardBody, Skeleton } from '@heroui/react'
import { CARD_STYLES } from '@renderer/utils/card-styles'

export const ProxyCardSkeleton: React.FC = () => {
  return (
    <Card className={`${CARD_STYLES.GLASS_CARD} w-full`} shadow="sm">
      <CardBody className="p-3">
        <div className="flex justify-between items-start gap-3">
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex items-center gap-2">
              <Skeleton className="w-16 h-4" />
              <Skeleton className="w-8 h-4" />
            </div>
            <Skeleton className="w-24 h-3" />
          </div>
          <Skeleton className="w-10 h-5" />
        </div>
        <div className="mt-3 flex justify-between items-center">
          <Skeleton className="w-32 h-3" />
          <Skeleton className="w-4 h-4 rounded-full" />
        </div>
      </CardBody>
    </Card>
  )
}
