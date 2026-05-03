export default function debounce<This, Args extends unknown[]>(
  func: (this: This, ...args: Args) => void,
  wait: number
): (this: This, ...args: Args) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null

  return function (this: This, ...args: Args) {
    if (timeout !== null) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => func.apply(this, args), wait)
  }
}
