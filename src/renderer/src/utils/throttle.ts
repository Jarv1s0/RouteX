export interface ThrottleOptions {
  leading?: boolean
  trailing?: boolean
}

export type ThrottledFunction<T extends (...args: never[]) => unknown> = ((
  ...args: Parameters<T>
) => ReturnType<T> | undefined) & {
  cancel: () => void
  flush: () => ReturnType<T> | undefined
}

export default function throttle<T extends (...args: never[]) => unknown>(
  func: T,
  wait = 0,
  options: ThrottleOptions = {}
): ThrottledFunction<T> {
  let timerId: ReturnType<typeof setTimeout> | undefined
  let lastArgs: Parameters<T> | undefined
  let lastCallTime: number | undefined
  let lastInvokeTime = 0
  let result: ReturnType<T> | undefined

  const leading = options.leading ?? true
  const trailing = options.trailing ?? true

  const invokeFunc = (time: number): ReturnType<T> => {
    lastInvokeTime = time
    const args = lastArgs!

    lastArgs = undefined
    result = func(...args) as ReturnType<T>
    return result
  }

  const startTimer = (pendingFunc: () => void, timeout: number) => {
    return setTimeout(pendingFunc, timeout)
  }

  const shouldInvoke = (time: number): boolean => {
    if (lastCallTime === undefined) {
      return true
    }

    const timeSinceLastCall = time - lastCallTime
    const timeSinceLastInvoke = time - lastInvokeTime

    return timeSinceLastCall >= wait || timeSinceLastCall < 0 || timeSinceLastInvoke >= wait
  }

  const remainingWait = (time: number): number => {
    const timeSinceLastCall = time - (lastCallTime ?? 0)
    const timeSinceLastInvoke = time - lastInvokeTime
    return Math.min(wait - timeSinceLastCall, wait - timeSinceLastInvoke)
  }

  const trailingEdge = (time: number): ReturnType<T> | undefined => {
    timerId = undefined

    if (trailing && lastArgs) {
      return invokeFunc(time)
    }

    lastArgs = undefined
    return result
  }

  const timerExpired = (): void => {
    const time = Date.now()

    if (shouldInvoke(time)) {
      trailingEdge(time)
      return
    }

    timerId = startTimer(timerExpired, remainingWait(time))
  }

  const leadingEdge = (time: number): ReturnType<T> | undefined => {
    lastInvokeTime = time
    timerId = startTimer(timerExpired, wait)
    return leading ? invokeFunc(time) : result
  }

  const throttled = (...args: Parameters<T>) => {
    const time = Date.now()
    const canInvoke = shouldInvoke(time)

    lastArgs = args
    lastCallTime = time

    if (canInvoke) {
      if (timerId === undefined) {
        return leadingEdge(time)
      }

      clearTimeout(timerId)
      timerId = startTimer(timerExpired, wait)
      return invokeFunc(time)
    }

    if (timerId === undefined) {
      timerId = startTimer(timerExpired, wait)
    }

    return result
  }

  throttled.cancel = () => {
    if (timerId !== undefined) {
      clearTimeout(timerId)
    }

    timerId = undefined
    lastArgs = undefined
    lastCallTime = undefined
    lastInvokeTime = 0
  }

  throttled.flush = () => {
    if (timerId === undefined) {
      return result
    }

    return trailingEdge(Date.now())
  }

  return throttled as ThrottledFunction<T>
}
