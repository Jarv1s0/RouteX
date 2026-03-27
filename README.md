# RouteX

<p align="center">
  <img src="resources/icon.png" width="128" height="128" alt="RouteX Logo">
</p>

<p align="center">
  基于 <a href="https://github.com/MetaCubeX/mihomo">Mihomo</a> 核心的现代跨平台代理客户端
</p>

<p align="center">
  <a href="https://github.com/Jarv1s0/RouteX/releases">
    <img src="https://img.shields.io/github/v/release/Jarv1s0/RouteX?style=flat-square&color=007AFF&label=Release" alt="Release">
  </a>
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-333333?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/github/license/Jarv1s0/RouteX?style=flat-square" alt="License">
</p>

---

## 项目简介

RouteX 是一个面向桌面端的跨平台代理客户端，基于 [Sparkle](https://github.com/xishang0128/sparkle) 修改而来，并以内置的 [Mihomo](https://github.com/MetaCubeX/mihomo) 内核为核心运行时。

它聚焦于两件事：

- 提供更现代、顺滑、易读的代理管理体验
- 为复杂代理配置提供更直观的可视化操作入口

## 功能亮点

- **现代化界面**：支持透明磨砂玻璃风格、深色模式与响应式布局
- **链路可视化**：展示从源进程到目标服务器的完整连接跳转路径
- **策略组管理**：支持拖拽排序、延迟测速、节点筛选等常用操作
- **实时仪表盘**：监控上传下载速率、内存占用与活跃连接数
- **网络工具集**：内置 DNS 查询、GeoIP、流媒体检测与延迟测试
- **规则编辑能力**：支持规则管理、颜色区分与实时匹配测试

## 下载与安装

请前往 [Releases](https://github.com/Jarv1s0/RouteX/releases) 页面下载对应平台的安装包。

| 平台 | 安装包格式 | 说明 |
|------|------------|------|
| **Windows** | `.exe` / `.7z` | 推荐使用 Setup 安装包 |
| **macOS** | `.dmg` / `.pkg` | 支持 Intel 与 Apple Silicon |
| **Linux** | `.deb` / `.AppImage` | 适用于主流发行版 |

## 本地开发

### 环境准备

- Node.js 开发环境
- Corepack
- `pnpm@10.15.0`（仓库当前使用的包管理器版本）

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

说明：

- `pnpm build` 会执行类型检查并构建 Electron 应用
- `pnpm build:unpack` 会生成未打包目录，适合本地验证
- `pnpm build:win`、`pnpm build:mac`、`pnpm build:linux` 为发布流程命令，默认包含 `--publish always`

## 项目结构

```text
src/
├─ main/       Electron 主进程
├─ preload/    预加载层
├─ renderer/   React 渲染层
└─ shared/     共享类型与通用逻辑

scripts/       构建与准备脚本
resources/     图标与静态资源
```

## 技术栈

- **桌面框架**：Electron 37
- **前端框架**：React 19
- **UI 组件**：HeroUI
- **样式方案**：Tailwind CSS v4
- **状态管理**：Zustand
- **图表能力**：ECharts
- **构建工具**：Electron-Vite

## 更新记录

版本更新说明见 `changelog.md`。

## 致谢

本项目离不开以下开源项目：

- [Mihomo](https://github.com/MetaCubeX/mihomo)
- [Sparkle](https://github.com/xishang0128/sparkle)
- [Electron](https://www.electronjs.org/)
- [React](https://react.dev/)
- [HeroUI](https://www.heroui.com/)

## 许可证

本项目基于 GPL-3.0 许可证发布，并与上游 [Sparkle](https://github.com/xishang0128/sparkle) 保持一致。详见 [LICENSE](LICENSE)。
