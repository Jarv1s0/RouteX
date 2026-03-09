import { Card, Skeleton } from '@heroui/react'

export const ProxiesSkeleton = () => {
  return (
    <div className="h-full w-full p-4 flex flex-col gap-4">
      {/* Header Area */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Skeleton className="rounded-lg w-24 h-10" />
          <Skeleton className="rounded-lg w-24 h-10" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="rounded-full w-10 h-10" />
          <Skeleton className="rounded-full w-10 h-10" />
        </div>
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-hidden">
        {Array.from({ length: 12 }).map((_, i) => (
          <Card key={i} className="space-y-3 p-4" radius="lg">
            <div className="flex items-center justify-between">
              <Skeleton className="rounded-lg w-3/5 h-6" />
              <Skeleton className="rounded-full w-8 h-8" />
            </div>
            <div className="space-y-2">
              <Skeleton className="rounded-lg w-4/5 h-4" />
              <Skeleton className="rounded-lg w-2/5 h-4" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
