# RouteX

<p align="center">
  <img src="resources/icon.png" width="128" height="128" alt="RouteX Logo">
</p>

<p align="center">
  <strong>基于 <a href="https://github.com/MetaCubeX/mihomo">Mihomo</a> 的跨平台代理桌面客户端</strong>
</p>

<p align="center">
  <a href="https://github.com/Jarv1s0/RouteX/releases">
    <img src="https://img.shields.io/github/v/release/Jarv1s0/RouteX?style=flat-square&color=007AFF&label=Release" alt="Release">
  </a>
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-333333?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/github/license/Jarv1s0/RouteX?style=flat-square" alt="License">
</p>

RouteX 是一个 Tauri 2 桌面客户端，用于管理 Mihomo 运行时、代理策略、系统代理、TUN、订阅配置、规则、连接、日志和网络诊断工具。

## 主要能力

- 代理控制：查看 Mihomo 状态，切换出站模式，管理系统代理和 TUN。
- 策略组管理：查看代理组和节点，执行节点切换、筛选、测速和链路查看。
- 配置管理：维护本地配置、订阅配置、覆写配置和 Proxy Provider。
- 规则管理：查看规则与规则 Provider，支持规则匹配测试和配置编辑入口。
- 连接观测：查看实时连接、历史连接、连接详情、网络拓扑和运行日志。
- 统计分析：记录实时流量、日流量、账期统计、规则命中和流量排行。
- 网络工具：提供 DNS 查询、连通性测试、流媒体解锁检测和 IP 信息查询。

## 下载

从 [Releases](https://github.com/Jarv1s0/RouteX/releases) 下载安装包。

- Windows：通常使用 `.exe` 或 `.msi`。
- macOS：通常使用 `.dmg`。
- Linux：通常使用 `.deb`、`.rpm` 或 `.AppImage`。

实际文件名和格式以当前 Release 产物为准。

## 本地开发

### 环境要求

- Node.js
- Rust stable toolchain
- Corepack
- `pnpm@10.15.0`
- 当前平台所需的 Tauri 2 系统依赖

### 安装依赖

```powershell
corepack enable
pnpm install
```

### 启动桌面端

```powershell
pnpm dev
```

`pnpm dev` 会启动 Tauri 宿主，并通过 `scripts/ensure-tauri-dev-server.mjs` 准备前端开发服务。

### 只启动前端调试服务

```powershell
pnpm dev:tauri-web
```

该命令只运行 Vite，适合单独调试 `src/tauri-web` 前端入口，不会启动 Tauri 桌面宿主。

## 验证与构建

### 常用检查

```powershell
pnpm lint:ci
pnpm typecheck
pnpm verify
```

`pnpm verify` 会执行 TypeScript 检查、Rust 测试、死代码检查和 Tauri 前端构建。

### 构建安装包

```powershell
pnpm build
```

平台别名：

```powershell
pnpm build:win
pnpm build:mac
pnpm build:linux
```

当前平台别名都会调用同一套 `pnpm build` 流程。构建产物位于 `src-tauri/target/release/bundle`，具体格式由 Tauri bundler 和当前平台决定。

## 项目结构

```text
src/
  renderer/       React 渲染层源码
  shared/         前后端共享类型、默认配置和通用逻辑
  tauri-web/      Tauri WebView 入口页面

src-tauri/
  src/            Tauri Rust 宿主逻辑
  tauri.conf.json Tauri 应用、窗口、打包和插件配置

scripts/          构建、资源准备和工程检查脚本
resources/        应用图标、安装器图片和静态资源
extra/            打包进应用的 sidecar 与附加文件
patches/          pnpm patch 补丁
```

## 主要页面

当前渲染层包含以下主要页面：

- `/proxies`：代理组与节点。
- `/connections`：连接列表与连接详情。
- `/profiles`：配置、订阅和覆写管理。
- `/mihomo`：Mihomo 核心相关设置。
- `/rules`：规则与规则 Provider。
- `/sysproxy`：系统代理。
- `/tun`：TUN。
- `/dns`：DNS。
- `/sniffer`：Sniffer。
- `/stats`：统计中心。
- `/tools`：网络工具。
- `/logs`：日志。
- `/map`：网络拓扑。
- `/settings`：应用设置。

## 技术栈

- Tauri 2
- React 19
- TypeScript
- Vite 7
- HeroUI
- Tailwind CSS v4
- Zustand
- ECharts

## 更新记录

版本更新说明见 [changelog.md](changelog.md)。

## 致谢

- [Mihomo](https://github.com/MetaCubeX/mihomo)
- [Tauri](https://tauri.app/)
- [React](https://react.dev/)
- [HeroUI](https://www.heroui.com/)

## 许可证

本项目基于 GPL-3.0 许可证发布。详见 [LICENSE](LICENSE)。
