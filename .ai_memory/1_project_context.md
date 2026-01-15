# RouteX 项目核心知识库 (Updated: 2026-02-26)

## 0. 基本信息
- **项目名称**: RouteX
- **当前版本**: 2.2.0
- **核心定位**: 基于 Sparkle/Mihomo 的高性能 Electron Clash 客户端，追求极致的响应式设计与可视化体验。

## 1. 技术栈 (Latest Tech Stack)
### 核心框架
- **Runtime**: Electron 37.10.x
- **Build Tool**: electron-vite 4.0 (Vite 7.2)
- **Language**: TypeScript 5.9+

### 前端 UI 层
- **Framework**: React 19.x
- **Styling**: TailwindCSS v4.1 (使用 @tailwindcss/vite)
- **Components**: HeroUI (v2.8.5), Sonner (Toast), React Icons 5.5
- **Animations**: Framer Motion 12.2
- **Editor**: Monaco Editor (react-monaco-editor)
- **Charting**: Recharts 3.5, ECharts 6.0
- **Flow/Map**: @xyflow/react (用于节点图和拓扑图)

### 状态与数据处理
- **Store**: Zustand 5.0 (全局状态管理)
- **Data Fetching**: SWR 2.3 (远程数据同步)
- **Internal API**: Axios 1.13
- **Configuration**: YAML 2.8, dayjs 1.11

## 2. 软件架构
### 目录结构 (Source Hierarchy)
- `src/main/`: 主进程逻辑。
  - `config/`: 配置文件读取与差异对比。
  - `core/`: Mihomo 内核生命周期管理 (spawn, restart, stop)。
  - `ipc/`: 渲染进程通信处理。
  - `resolve/`: 流量统计、节点状态分析。
  - `sys/`: 系统代理 (Sysproxy)、DNS 设置。
- `src/renderer/`: 渲染进程 (Webkit)。
  - `components/`: 基于功能模块化的组件 (mihomo, proxies, stats, flow等)。
  - `pages/`: 路由页面。
  - `utils/`: 渲染进程专用工具。
- `src/preload/`: 安全隔离的 IPC 桥接层。
- `shared/`: 主/渲染进程共享的类型定义 (Types)。

## 3. 核心功能点
- **可视化节点管理**: 使用 XYFlow 实现的 GlobalNodeMap 与拓扑视图。
- **内核热切换**: 支持 Mihomo (Stable) 与 Mihomo Alpha 内核切换及自动升级。
- **响应式 UI**: 深度适配双栏布局，自适应窗口缩放。
- **高级统计**: 实时流量监控、Provider 状态持久化展示。

## 4. 开发约定 (Project Rules)
- **包管理**: 强制使用 `pnpm@10.x`。
- **记忆管理**: 遵循 `.agent/rules/memory_sync.md`，每次完成任务必须将关键变更记入 `.ai_memory`。
- **UI 风格**: 玻璃拟态 (Glassmorphism)、暗色模式优先、高性能虚拟滚动 (react-virtuoso)。
