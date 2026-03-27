# RouteX

<p align="center">
  <img src="resources/icon.png" width="128" height="128" alt="RouteX Logo">
</p>

<p align="center">
  <strong>基于 <a href="https://github.com/MetaCubeX/mihomo">Mihomo</a> 核心的现代跨平台代理客户端</strong>
</p>

<p align="center">
  面向日常使用与复杂配置场景，兼顾视觉体验、连接可观测性与配置管理效率
</p>

<p align="center">
  <a href="https://github.com/Jarv1s0/RouteX/releases">
    <img src="https://img.shields.io/github/v/release/Jarv1s0/RouteX?style=flat-square&color=007AFF&label=Release" alt="Release">
  </a>
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-333333?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/github/license/Jarv1s0/RouteX?style=flat-square" alt="License">
</p>

---

## ✨ 项目简介

RouteX 是一个桌面端跨平台代理客户端，基于 [Sparkle](https://github.com/xishang0128/sparkle) 修改而来，并以内置的 [Mihomo](https://github.com/MetaCubeX/mihomo) 内核为核心运行时。

- 🚀 让代理切换、策略选择与系统代理控制更直观
- 🔍 让连接、规则、流量与节点状态更容易观察和排查
- 🧩 让订阅、覆写、配置编辑与多来源管理更顺手
- 🎨 让桌面客户端在观感、反馈和交互细节上更现代

## 🌟 核心特性

### 🚦 代理控制

- **Mihomo 核心集成**：围绕 Mihomo 运行时提供完整桌面控制能力
- **系统代理与 TUN 管理**：支持系统代理、TUN、Mihomo 相关页面与状态联动
- **策略组快速切换**：支持策略组节点切换、测速、筛选与批量查看
- **连接快速干预**：支持关闭连接、暂停连接刷新、针对连接快速生成规则

### 📦 订阅与配置管理

- **订阅配置管理**：支持多配置文件维护、切换、排序和编辑
- **Proxy Provider 管理**：可查看 Provider 内容并执行更新
- **SubStore 集成**：支持 SubStore 订阅与集合管理场景
- **覆写能力**：支持覆写编辑、应用与异常时的回滚恢复
- **规则与资源编辑**：提供直观的规则、配置与资源查看入口

### 📡 连接与可观测性

- **实时连接列表**：区分活动连接与已关闭连接，支持筛选、排序与分组查看
- **连接详情面板**：展示连接目标、命中规则、进程信息与更多上下文
- **网络拓扑视图**：以更直观的方式查看连接关系与链路结构
- **统计中心**：提供实时流量、日流量、账期统计、规则命中与排行能力
- **日志查看**：支持在客户端内查看运行日志，方便定位问题

### 🧰 网络工具箱

- **DNS 查询**：支持常见记录类型查询与结果展示
- **规则匹配测试**：输入目标后快速验证规则命中结果
- **连通性测试**：内置常用目标站点测速与访问性测试
- **流媒体解锁检测**：检测 ChatGPT、Netflix、YouTube、Spotify 等服务可用性
- **IP 信息查询**：查看出口 IP、地域、运营商与时区等信息
- **Sniffer / DNS / SysProxy / TUN 页面**：补齐更完整的网络调试与代理控制能力

### 🎨 界面与体验

- **现代化桌面界面**：支持深色模式、磨砂玻璃风格与更统一的视觉语言
- **顺滑交互反馈**：页面切换、弹窗、图表与列表交互更细腻
- **按页面启停监听**：减少无效后台事件处理，降低资源消耗
- **远程图标本地缓存**：减轻工具页和订阅页的图标闪烁与重复加载


## 📥 下载与安装

请前往 [Releases](https://github.com/Jarv1s0/RouteX/releases) 页面下载对应平台的安装包。

| 平台 | 安装包格式 | 说明 |
|------|------------|------|
| **Windows** | `.exe` / `.7z` | 推荐优先使用 Setup 安装包 |
| **macOS** | `.dmg` / `.pkg` | 支持 Intel 与 Apple Silicon |
| **Linux** | `.deb` / `.AppImage` | 适用于主流发行版 |

## 🛠️ 本地开发

### 环境要求

- Node.js
- Corepack
- `pnpm@10.15.0`

### 安装依赖

```powershell
corepack enable
pnpm install
```

### 启动开发环境

```powershell
pnpm dev
```

### 代码检查

```powershell
pnpm typecheck
pnpm lint:ci
```

### 构建

```powershell
pnpm build
pnpm build:unpack
```

补充说明：

- `pnpm build` 会先执行类型检查，再构建 Electron 应用
- `pnpm build:unpack` 会输出未打包目录，适合本地验证
- `pnpm build:win`、`pnpm build:mac`、`pnpm build:linux` 默认包含 `--publish always`

## 🧱 项目结构

```text
src/
├─ main/       Electron 主进程
├─ preload/    预加载层
├─ renderer/   React 渲染层
└─ shared/     共享类型与通用逻辑

scripts/       构建与准备脚本
resources/     图标与静态资源
```

## ⚙️ 技术栈

- 🖥️ **桌面框架**：Electron 37
- ⚛️ **前端框架**：React 19
- 🧩 **UI 组件**：HeroUI
- 🎨 **样式方案**：Tailwind CSS v4
- 🗃️ **状态管理**：Zustand
- 📈 **图表能力**：ECharts
- 🔧 **构建工具**：Electron-Vite

## 📝 更新记录

版本更新说明见 `changelog.md`。

## 🙏 致谢

本项目离不开以下开源项目：

- [Mihomo](https://github.com/MetaCubeX/mihomo)
- [Sparkle](https://github.com/xishang0128/sparkle)
- [Electron](https://www.electronjs.org/)
- [React](https://react.dev/)
- [HeroUI](https://www.heroui.com/)

## 📄 许可证

本项目基于 GPL-3.0 许可证发布，并与上游 [Sparkle](https://github.com/xishang0128/sparkle) 保持一致。详见 [LICENSE](LICENSE)。
