import {
  autocompletion,
  snippetCompletion,
  type CompletionContext,
  type CompletionResult
} from '@codemirror/autocomplete'
import { linter, type Diagnostic } from '@codemirror/lint'
import { hoverTooltip, ViewPlugin } from '@codemirror/view'
import type { completeMihomoYaml, hoverMihomoYaml } from './mihomo-yaml-completions'
import type { MihomoYamlOptions } from './mihomo-yaml-diagnostics'
import { MIHOMO_V119_YAML_SNIPPETS } from '../../../shared/defaults/mihomo-templates'

type RequestType = 'lint' | 'complete' | 'hover'
type Response =
  Diagnostic[] | ReturnType<typeof completeMihomoYaml> | ReturnType<typeof hoverMihomoYaml>
function createYamlWorkerClient(getOptions: () => MihomoYamlOptions) {
  let worker: Worker | undefined
  let requestId = 0
  let destroyed = false
  const pending = new Map<
    number,
    { type: RequestType; resolve: (value: Response) => void; timer: ReturnType<typeof setTimeout> }
  >()
  const failure = (): Diagnostic[] => [
    {
      from: 0,
      to: 0,
      severity: 'info',
      message:
        getOptions().locale === 'en-US'
          ? 'Live validation is unavailable; saving remains available.'
          : '实时校验暂不可用，仍可保存配置。'
    }
  ]
  const finish = (id: number, result: Response): void => {
    const request = pending.get(id)
    if (!request) return
    clearTimeout(request.timer)
    pending.delete(id)
    request.resolve(result)
  }
  const stop = (): void => {
    worker?.terminate()
    worker = undefined
    for (const [id, request] of pending) finish(id, request.type === 'lint' ? failure() : null)
  }
  function request<T extends Response>(
    type: RequestType,
    text: string,
    position?: number
  ): Promise<T> {
    if (destroyed) return Promise.resolve((type === 'lint' ? [] : null) as T)
    // Retain at most one pending request of each kind during rapid typing.
    for (const [id, previous] of pending)
      if (previous.type === type) finish(id, type === 'lint' ? [] : null)
    return new Promise<T>((resolve) => {
      try {
        if (!worker) {
          worker = new Worker(new URL('../workers/mihomo-yaml-worker.ts', import.meta.url), {
            type: 'module'
          })
          worker.onmessage = (
            event: MessageEvent<{ id: number; result: Response; error?: boolean }>
          ) => {
            const current = pending.get(event.data.id)
            if (current)
              finish(
                event.data.id,
                event.data.error ? (current.type === 'lint' ? failure() : null) : event.data.result
              )
          }
          worker.onerror = stop
        }
        const id = ++requestId
        pending.set(id, {
          type,
          resolve: (result) => resolve(result as T),
          timer: setTimeout(stop, 15000)
        })
        worker.postMessage({ id, type, text, position, options: getOptions() })
      } catch {
        stop()
        resolve((type === 'lint' ? failure() : null) as T)
      }
    })
  }
  return {
    request,
    destroy() {
      destroyed = true
      stop()
    }
  }
}

export function createMihomoYamlSupport(getOptions: () => MihomoYamlOptions) {
  const workerPlugin = ViewPlugin.define(() => createYamlWorkerClient(getOptions))
  const complete = async (context: CompletionContext): Promise<CompletionResult | null> => {
    if (!context.view) return null
    const result = await context.view
      .plugin(workerPlugin)
      ?.request<ReturnType<typeof completeMihomoYaml>>(
        'complete',
        context.state.doc.toString(),
        context.pos
      )
    if (!result || context.aborted) return null
    const snippets =
      result.snippets || context.explicit
        ? MIHOMO_V119_YAML_SNIPPETS.map((item) =>
            snippetCompletion(item.snippet, {
              label: item.label,
              detail: item.detail,
              info: item.info,
              type: 'keyword'
            })
          )
        : []
    return { ...result, options: [...result.options, ...snippets], validFor: /^[\w-]*$/ }
  }
  return [
    workerPlugin,
    autocompletion({ override: [complete] }),
    linter(
      (view) =>
        view.plugin(workerPlugin)?.request<Diagnostic[]>('lint', view.state.doc.toString()) || [],
      { delay: 600 }
    ),
    hoverTooltip(async (view, position) => {
      const result = await view
        .plugin(workerPlugin)
        ?.request<ReturnType<typeof hoverMihomoYaml>>('hover', view.state.doc.toString(), position)
      if (!result) return null
      return {
        pos: result.from,
        end: result.to,
        above: true,
        create: () => {
          const dom = document.createElement('div')
          dom.className = 'max-w-sm whitespace-pre-wrap px-3 py-2 text-xs leading-relaxed'
          dom.textContent = result.description
          return { dom }
        }
      }
    })
  ]
}
