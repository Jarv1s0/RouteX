const MIHOMO_CORE_CHANGED_EVENT = 'mihomo-core-changed'
const mihomoCoreEventTarget = new EventTarget()

export function emitMihomoCoreChanged(): void {
  mihomoCoreEventTarget.dispatchEvent(new Event(MIHOMO_CORE_CHANGED_EVENT))
}

export function onMihomoCoreChanged(listener: () => void): () => void {
  const handleEvent = (): void => {
    listener()
  }

  mihomoCoreEventTarget.addEventListener(MIHOMO_CORE_CHANGED_EVENT, handleEvent)

  return () => {
    mihomoCoreEventTarget.removeEventListener(MIHOMO_CORE_CHANGED_EVENT, handleEvent)
  }
}

