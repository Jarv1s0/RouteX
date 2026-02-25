import { Card, Skeleton } from '@heroui/react'

export const StatsSkeleton = () => {
  return (
    <div className="w-full h-full p-2 flex flex-col gap-2">
      {/* Status Grid Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-3 bg-default-100/50 flex flex-col gap-2" radius="lg">
            <Skeleton className="h-3 w-1/2 rounded-lg" />
            <Skeleton className="h-7 w-3/4 rounded-lg" />
            <Skeleton className="h-2 w-full rounded-lg" />
          </Card>
        ))}
      </div>

      {/* Traffic Chart Skeleton */}
      <Card className="p-4 bg-default-100/50 flex flex-col gap-3" radius="lg">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24 rounded-lg" />
          <Skeleton className="h-7 w-28 rounded-lg" />
        </div>
        <Skeleton className="h-36 w-full rounded-xl" />
      </Card>

      {/* Traffic Ranking Skeleton */}
      <Card className="p-4 bg-default-100/50 flex flex-col gap-3" radius="lg">
        <Skeleton className="h-4 w-28 rounded-lg" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="rounded-full w-8 h-8 shrink-0" />
            <div className="flex flex-col gap-1.5 flex-1">
              <Skeleton className="h-3 w-1/3 rounded-lg" />
              <Skeleton className="h-2 w-1/2 rounded-lg" />
            </div>
            <Skeleton className="h-3 w-16 rounded-lg" />
          </div>
        ))}
      </Card>
    </div>
  )
}
