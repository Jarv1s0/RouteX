export function createQueuedAsyncRunner(
  task: () => Promise<void>,
  onError?: (error: unknown) => void
): () => void {
  let running = false
  let queued = false

  const run = (): void => {
    if (running) {
      queued = true
      return
    }

    running = true
    void task()
      .catch((error) => {
        onError?.(error)
      })
      .finally(() => {
        running = false
        if (!queued) {
          return
        }

        queued = false
        run()
      })
  }

  return run
}
