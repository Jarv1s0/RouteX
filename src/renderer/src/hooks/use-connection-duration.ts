import { useEffect, useState } from 'react'
import dayjs from 'dayjs'

export function useConnectionDuration(start: string, completedAt?: string) {
  const [duration, setDuration] = useState('')

  useEffect(() => {
    const updateDuration = () => {
      const end = completedAt ? dayjs(completedAt) : dayjs()
      const diff = end.diff(dayjs(start))
      const hours = Math.floor(diff / 3600000)
      const minutes = Math.floor((diff % 3600000) / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)
      setDuration(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      )
    }

    updateDuration()

    // 如果已经有结束时间，则不需要定时器刷新
    if (completedAt) return

    const timer = setInterval(updateDuration, 1000)
    return () => clearInterval(timer)
  }, [start, completedAt])

  return duration
}
