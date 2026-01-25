import { Card, Skeleton } from '@heroui/react'

export const ConnectionsSkeleton = () => {
  return (
    <div className="w-full h-full p-2 flex flex-col gap-2">
      {/* Header Toolbar */}
      <div className="h-10 w-full flex items-center gap-2">
         <Skeleton className="rounded-lg w-48 h-9" />
         <Skeleton className="rounded-lg w-32 h-9" />
         <div className="flex-1"></div>
         <Skeleton className="rounded-lg w-9 h-9" />
         <Skeleton className="rounded-lg w-9 h-9" />
      </div>
      
      {/* List items */}
      <div className="flex-1 flex flex-col gap-2 overflow-hidden">
        {Array.from({ length: 12 }).map((_, i) => (
          <Card key={i} className="w-full p-2 space-y-2 h-[60px] bg-default-100/50" radius="lg">
            <div className="flex items-center gap-3">
               <Skeleton className="rounded-full w-8 h-8" />
               <div className="flex flex-col gap-1 w-1/3">
                 <Skeleton className="h-3 w-3/4 rounded-lg"/>
                 <Skeleton className="h-2 w-1/2 rounded-lg"/>
               </div>
               <div className="flex-1"></div>
               <Skeleton className="h-3 w-16 rounded-lg"/>
               <Skeleton className="h-3 w-16 rounded-lg"/>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
