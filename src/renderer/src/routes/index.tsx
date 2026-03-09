import React from 'react'
import { Navigate } from 'react-router-dom'

const Override = React.lazy(() => import('@renderer/pages/override'))
const Proxies = React.lazy(() => import('@renderer/pages/proxies'))
const Rules = React.lazy(() => import('@renderer/pages/rules'))
const Settings = React.lazy(() => import('@renderer/pages/settings'))
const Profiles = React.lazy(() => import('@renderer/pages/profiles'))
const Logs = React.lazy(() => import('@renderer/pages/logs'))
const Connections = React.lazy(() => import('@renderer/pages/connections'))
const Mihomo = React.lazy(() => import('@renderer/pages/mihomo'))
const Sysproxy = React.lazy(() => import('@renderer/pages/sysproxy'))
const Tun = React.lazy(() => import('@renderer/pages/tun'))

const DNS = React.lazy(() => import('@renderer/pages/dns'))
const Sniffer = React.lazy(() => import('@renderer/pages/sniffer'))
const SubStore = React.lazy(() => import('@renderer/pages/substore'))
const Stats = React.lazy(() => import('@renderer/pages/stats'))
const Tools = React.lazy(() => import('@renderer/pages/tools'))
const Map = React.lazy(() => import('@renderer/pages/map'))

const routes = [
  {
    path: '/mihomo',
    element: <Mihomo />
  },
  {
    path: '/sysproxy',
    element: <Sysproxy />
  },
  {
    path: '/tun',
    element: <Tun />
  },
  {
    path: '/proxies',
    element: <Proxies />
  },
  {
    path: '/rules',
    element: <Rules />
  },

  {
    path: '/dns',
    element: <DNS />
  },
  {
    path: '/sniffer',
    element: <Sniffer />
  },
  {
    path: '/logs',
    element: <Logs />
  },
  {
    path: '/connections',
    element: <Connections />
  },
  {
    path: '/override',
    element: <Override />
  },
  {
    path: '/profiles',
    element: <Profiles />
  },
  {
    path: '/settings',
    element: <Settings />
  },
  {
    path: '/substore',
    element: <SubStore />
  },
  {
    path: '/stats',
    element: <Stats />
  },
  {
    path: '/tools',
    element: <Tools />
  },
  {
    path: '/map',
    element: <Map />
  },
  {
    path: '/',
    element: <Navigate to="/proxies" />
  }
]

export default routes
