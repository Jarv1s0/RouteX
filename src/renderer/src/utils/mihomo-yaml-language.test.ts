// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { startCompletion, currentCompletions } from '@codemirror/autocomplete'
import { waitFor } from '@testing-library/react'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { forceLinting } from '@codemirror/lint'
import { createMihomoYamlSupport } from './mihomo-yaml-language'

class MockWorker {
  static instances: MockWorker[] = []
  onmessage?: (event: MessageEvent) => void
  onerror?: () => void
  messages: { id: number; type: string }[] = []
  terminated = false
  constructor() {
    MockWorker.instances.push(this)
  }
  postMessage(message: { id: number; type: string }): void {
    this.messages.push(message)
    queueMicrotask(() =>
      this.onmessage?.({
        data: {
          id: message.id,
          result:
            message.type === 'complete'
              ? {
                  from: 7,
                  to: 10,
                  options: [{ label: 'enable', type: 'property', apply: 'enable: ' }]
                }
              : []
        }
      } as MessageEvent)
    )
  }
  terminate(): void {
    this.terminated = true
  }
}
const views: EditorView[] = []
afterEach(() => {
  views.splice(0).forEach((view) => view.destroy())
  MockWorker.instances = []
  vi.unstubAllGlobals()
})

it('creates independent workers when editor views reuse extensions across diff transitions', async () => {
  vi.stubGlobal('Worker', MockWorker)
  const extensions = createMihomoYamlSupport(() => ({ locale: 'zh-CN' }))
  for (let transition = 0; transition < 3; transition++) {
    const view = new EditorView({
      state: EditorState.create({ doc: 'dns:\n  ena', selection: { anchor: 10 }, extensions })
    })
    views.push(view)
    startCompletion(view)
    await waitFor(() => expect(currentCompletions(view.state)[0]?.label).toBe('enable'))
    forceLinting(view)
    await Promise.resolve()
    expect(MockWorker.instances.at(-1)?.messages.some((message) => message.type === 'lint')).toBe(
      true
    )
    view.destroy()
    views.pop()
    expect(MockWorker.instances.at(-1)?.terminated).toBe(true)
  }
  expect(MockWorker.instances).toHaveLength(3)
})
