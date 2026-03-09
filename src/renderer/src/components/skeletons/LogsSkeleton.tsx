import { Skeleton } from '@heroui/react'

export const LogsSkeleton = () => {
  return (
    <div className="h-full w-full p-4 flex flex-col gap-4">
      {/* Search Bar */}
      <Skeleton className="rounded-xl w-full h-12" />

      {/* Logs List */}
      <div className="flex-1 flex flex-col gap-2 overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="flex gap-4 items-start py-2 border-b border-default-100">
             <Skeleton className="rounded-md w-24 h-5" />
             <Skeleton className="rounded-md w-16 h-5" />
             <Skeleton className="rounded-md flex-1 h-5" />
          </div>
        ))}
      </div>
    </div>
  )
}
