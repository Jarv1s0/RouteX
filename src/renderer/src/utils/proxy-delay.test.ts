import { beforeEach, describe, expect, it } from 'vitest'
import { useGroupsStore } from '@renderer/store/use-groups-store'
import { getGroupCurrentDelay, getProxyDisplayDelay, getResolvedProxyTarget } from './proxy-delay'

function history(delay: number, time: string): ControllerProxiesHistory[] {
  return [{ delay, time }]
}

function extra(delay: number, time: string): { alive: boolean; history: ControllerProxiesHistory[] } {
  return { alive: delay > 0, history: history(delay, time) }
}

function proxy(name: string, items: ControllerProxiesHistory[] = []): ControllerProxiesDetail {
  return {
    alive: true,
    extra: {},
    history: items,
    id: name,
    name,
    tfo: false,
    type: 'Shadowsocks',
    udp: true,
    xudp: false,
    'dialer-proxy': '',
    interface: '',
    mptcp: false,
    'routing-mark': 0,
    smux: false,
    uot: false
  }
}

function group(
  name: string,
  now: string,
  all: ControllerMixedGroup['all'],
  extraMap: ControllerGroupDetail['extra'] = {}
): ControllerMixedGroup {
  return {
    alive: true,
    all,
    extra: extraMap,
    hidden: false,
    history: [],
    icon: '',
    interface: '',
    mptcp: false,
    name,
    now,
    smux: false,
    tfo: false,
    type: 'Selector',
    udp: true,
    uot: false,
    xudp: false
  }
}

describe('proxy delay display', () => {
  beforeEach(() => {
    useGroupsStore.setState({ groups: [], isLoading: false })
  })

  it('uses the resolved leaf node delay instead of the parent group extra delay', () => {
    const us01 = proxy('美国01', history(0, '2026-05-07T10:00:00.000Z'))
    const us = group('美国', '美国01', [us01], {
      美国01: extra(160, '2026-05-07T10:01:00.000Z')
    })
    const ai = group('AI', '美国', [us], {
      美国: extra(200, '2026-05-07T09:59:00.000Z')
    })

    useGroupsStore.setState({ groups: [ai, us] })

    expect(getGroupCurrentDelay(ai)).toBe(0)
    expect(getGroupCurrentDelay(us)).toBe(0)
    expect(getResolvedProxyTarget(ai)?.name).toBe('美国01')
  })

  it('ignores group extra delay when the same leaf appears in multiple groups', () => {
    const us01 = proxy('美国01', history(180, '2026-05-07T09:58:00.000Z'))
    const ai = group('AI', '美国01', [us01], {
      美国01: extra(200, '2026-05-07T09:59:00.000Z')
    })
    const us = group('美国', '美国01', [us01], {
      美国01: extra(0, '2026-05-07T10:00:00.000Z')
    })

    useGroupsStore.setState({ groups: [ai, us] })

    expect(getGroupCurrentDelay(ai)).toBe(180)
    expect(getGroupCurrentDelay(us)).toBe(180)
    expect(getProxyDisplayDelay(us01)).toBe(180)
  })
})
