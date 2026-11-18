/// <reference lib="webworker" />
import { diagnoseMihomoYaml, type MihomoYamlOptions } from '@renderer/utils/mihomo-yaml-diagnostics'
import { completeMihomoYaml, hoverMihomoYaml } from '@renderer/utils/mihomo-yaml-completions'

self.onmessage = (
  event: MessageEvent<{
    id: number
    text: string
    options: MihomoYamlOptions
    type: 'lint' | 'complete' | 'hover'
    position?: number
  }>
) => {
  const { id, text, options, type, position = 0 } = event.data
  try {
    const result =
      type === 'lint'
        ? diagnoseMihomoYaml(text, options)
        : type === 'complete'
          ? completeMihomoYaml(text, position)
          : hoverMihomoYaml(text, position)
    self.postMessage({ id, result })
  } catch {
    self.postMessage({ id, error: true })
  }
}
