import { Card, Skeleton } from '@heroui/react'

export const RulesSkeleton = () => {
  return (
    <div className="h-full w-full p-4 flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-2">
        <Skeleton className="rounded-lg w-48 h-10" />
        <Skeleton className="rounded-lg w-32 h-10" />
      </div>

      {/* List */}
      <div className="flex flex-col gap-3">
        {Array.from({ length: 15 }).map((_, i) => (
          <Card key={i} className="w-full p-3 flex flex-row items-center gap-4" radius="lg">
            <Skeleton className="rounded-lg w-16 h-8" />
            <div className="flex-1 flex flex-col gap-2">
              <Skeleton className="rounded-lg w-3/4 h-5" />
              <Skeleton className="rounded-lg w-1/2 h-4" />
            </div>
            <Skeleton className="rounded-lg w-24 h-8" />
          </Card>
        ))}
      </div>
    </div>
  )
}
