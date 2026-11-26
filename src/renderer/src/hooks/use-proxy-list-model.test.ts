// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { useProxyListModel } from './use-proxy-list-model'

function makeGroup(name: string, proxyNames: string[] = ['Node-A', 'Node-B']): ControllerMixedGroup {
  return {
    alive: true,
    extra: {},
    history: [],
    interface: '',
    mptcp: false,
    smux: false,
    tfo: false,
    udp: true,
    uot: false,
    xudp: false,
    name,
    type: 'Selector',
    now: proxyNames[0] ?? '',
    all: proxyNames.map((proxyName) => ({
      id: proxyName,
      name: proxyName,
      type: 'Shadowsocks',
      history: [{ time: '2026-11-25T00:00:00Z', delay: 80 }],
      extra: {},
      alive: true,
      tfo: false,
      xudp: false,
      udp: true,
      uot: false,
      mptcp: false,
      smux: false,
      'dialer-proxy': '',
      'routing-mark': 0,
      interface: ''
    })),
    hidden: false,
    icon: ''
  }
}

it('computes chunks only when a drawer group is active and filters by search query', () => {
  const allGroups = [
    makeGroup('GLOBAL', ['Proxy']),
    makeGroup('Proxy', ['Tokyo-01', 'US-01']),
    makeGroup('AI', ['US-Texas', 'Japan-Tokyo', 'Singapore-01'])
  ]

  const { result, rerender } = renderHook(
    ({ activeGroupName, searchQuery }: { activeGroupName: string | null; searchQuery: string }) =>
      useProxyListModel({
        mode: 'rule',
        allGroups,
        groupOrder: [],
        proxyDisplayOrder: 'default',
        proxyCols: '2',
        activeGroupName,
        searchQuery
      }),
    { initialProps: { activeGroupName: null as string | null, searchQuery: '' } }
  )

  expect(result.current.renderGroups.map((group) => group.name)).toEqual(['Proxy', 'AI'])
  expect(result.current.activeGroup).toBeNull()
  expect(result.current.proxyChunks).toEqual([])

  rerender({ activeGroupName: 'AI', searchQuery: 'tokyo' })
  expect(result.current.activeGroup?.name).toBe('AI')
  expect(result.current.proxyChunks.flat().map((node) => node.name)).toEqual(['Japan-Tokyo'])
})

it('resolves detailGroup directly in single-group global mode', () => {
  const allGroups = [makeGroup('GLOBAL', ['Node-A', 'Node-B']), makeGroup('Proxy', ['Node-A'])]

  const { result } = renderHook(() =>
    useProxyListModel({
      mode: 'global',
      allGroups,
      groupOrder: [],
      proxyDisplayOrder: 'default',
      proxyCols: 'auto',
      activeGroupName: null,
      searchQuery: ''
    })
  )

  expect(result.current.renderGroups.map((group) => group.name)).toEqual(['GLOBAL'])
  expect(result.current.detailGroup?.name).toBe('GLOBAL')
  expect(result.current.proxyChunks.flat().map((node) => node.name)).toEqual(['Node-A', 'Node-B'])
})
