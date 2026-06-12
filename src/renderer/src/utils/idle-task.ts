export function scheduleIdleTask(task: () => void, delay = 0, timeout = 4000): () => void {
  let idleId: number | null = null
  const win = window as Window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
    cancelIdleCallback?: (handle: number) => void
  }

  const timeoutId = window.setTimeout(() => {
    if (typeof win.requestIdleCallback === 'function') {
      idleId = win.requestIdleCallback(() => task(), { timeout })
      return
    }

    idleId = window.setTimeout(task, 0)
  }, delay)

  return () => {
    window.clearTimeout(timeoutId)
    if (idleId === null) {
      return
    }

    if (typeof win.cancelIdleCallback === 'function') {
      win.cancelIdleCallback(idleId)
      return
    }

    window.clearTimeout(idleId)
  }
}
