const IGNORED_RENDERER_MESSAGES = [
  "The Content Security Policy directive 'frame-ancestors' is ignored when delivered via a <meta> element.",
  'Download the React DevTools for a better development experience:',
  'Slow network is detected.',
  '[vite] connecting...',
  '[vite] connected.',
  'WARN: A component changed from uncontrolled to controlled.',
  'WARN: A component changed from controlled to uncontrolled.',
  'In HTML, %s cannot be a descendant of <%s>.',
  '<%s> cannot contain a nested %s.'
]

export function shouldReportRendererConsoleMessage(level: number, message: string): boolean {
  if (level < 3) {
    return false
  }

  return !IGNORED_RENDERER_MESSAGES.some((ignored) => message.includes(ignored))
}
