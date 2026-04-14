# RouteX Tauri 迁移进度文档

更新日期：2026-04-10

维护规则：

1. 每完成一个已验证的迁移项，都要同步更新本文件。
2. 未验证通过的内容不能写成“已完成”，只能写当前状态、阻塞或风险。

## 1. 当前结论

当前仓库里的 Tauri 迁移已经从“骨架验证”推进到“核心链路可编译、可构建、可打包，阶段 4 已按开发交付口径完成，阶段 5 已完成首版更新链路接入”的阶段，但还没有达到“可完全替代 Electron 主版本”的发布标准。

按 [`docs/tauri-rewrite-plan.md`](./tauri-rewrite-plan.md) 的阶段划分，当前进度判断如下：

1. 阶段 0：前端去 Electron 化，已完成。
2. 阶段 1：Tauri 宿主和主窗口，已完成。
3. 阶段 2：Mihomo 主链路迁移，已完成。
4. 阶段 3：系统能力迁移，开发实现已完成，待跨平台实机回归。
5. 阶段 4：托盘和悬浮窗迁移，已完成。
6. 阶段 5：构建和打包，开发实现已完成，待发布链与实机回归收口。
7. 阶段 6：回归与收口，已开始，完成首批默认链路收口。

## 2. 当前已完成内容

### 2.1 前端适配层

已完成：

1. 新增统一桌面桥接层，收敛 `window.electron` / `window.api` 的直接依赖。
2. 前端主要配置和桌面调用已经通过 `src/renderer/src/api` 与 `src/renderer/src/utils/*-ipc.ts` 间接访问。
3. Tauri 前端已支持主窗口、悬浮窗、托盘菜单三个入口页面产物。
4. Tauri 主窗口入口已切回正式 React 应用，不再默认显示迁移测试页。
5. 已修复主布局 `App.tsx` 被截断导致的侧边栏、拖拽分隔条、页面容器结构缺失问题。
6. 已补齐正式入口的 `OverrideConfigProvider`，避免 `profiles` / `override` 相关页面和弹窗因上下文缺失异常。
7. 已补齐正式入口的 `RulesProvider`，避免 `rules` 页面和规则相关组件因上下文缺失异常。
8. 已修复 Tauri 渲染构建链缺少 Tailwind 插件的问题，避免主窗口、悬浮窗、托盘菜单退化成未样式化布局。
9. 已补齐 Windows 下 Tauri 宿主的原生文件打开/保存对话框，前端在 Tauri 下会优先调用宿主能力。
10. 已补齐 Tauri 主题导入链路，前端和宿主都能处理真实文件路径，避免原生文件选择后主题导入失效。
11. 已补齐 `copyEnv` 的 Tauri 宿主实现，复制终端代理命令时会读取真实配置并写入系统剪贴板。
12. 已补齐 `relaunchApp` 的 Tauri 宿主实现，相关设置项不再退化为仅刷新页面。
13. 已补齐 Windows 下 `checkAutoRun` / `enableAutoRun` / `disableAutoRun` 的 Tauri 宿主实现，设置页开机自启不再是占位开关。
14. 已补齐 Windows 下权限弹窗的注册/取消注册闭环，`manualGrantCorePermition` 与 `revokeCorePermission` 都会落到真实任务计划操作。
15. 已补齐 macOS / Linux 下 `checkAutoRun` / `enableAutoRun` / `disableAutoRun` 的 Tauri 宿主实现，开机自启不再只在 Windows 可用。
16. 已补齐 `checkUpdate` 的 Tauri 宿主实现，设置页已经可以按当前更新通道检查是否存在新版本。
17. 已补齐 macOS / Linux 下 `checkCorePermission` / `manualGrantCorePermition` / `revokeCorePermission` 的 Tauri 宿主实现，非 Windows 权限弹窗不再固定返回占位状态。
18. 已补齐 `alert` 的 Tauri 宿主实现，调用该通道时会转成统一弹窗事件，不再静默丢失。
19. 已补齐 `findSystemMihomo` 的 Tauri 宿主实现，系统内核搜索不再固定返回空数组。
20. 已补齐 `getGistUrl` 的 Tauri 宿主实现，运行时配置同步入口不再固定返回空字符串。
21. 已补齐 macOS 下 `setDockVisible` 的 Tauri 宿主实现，Dock 图标开关不再是空操作。
22. 已补齐网络健康监控主链路，`startNetworkHealthMonitor` / `stopNetworkHealthMonitor` / `getNetworkHealthStats` / `testDNSLatency` / `getAppUptime` 不再是宿主占位。
23. 已补齐 `getProviderStats` / `clearProviderStats` 的 Tauri 宿主持久化实现，统计页订阅用量数据不再固定为空。
24. 已补齐 macOS / Linux 下原生文件打开与保存对话框，导入主题/配置和文本导出不再只在 Windows Tauri 宿主可用。
25. 已补齐 Tauri 下的流量历史与清空统计功能，`getTrafficStats` / `clearTrafficStats` 不再让统计页小时/日流量长期为空。
26. 已移除 `src/renderer/src/utils/mihomo-ipc.ts` 中的 `Tauri Demo` / 假数据回退，阶段 2 不再依赖演示数据掩盖宿主缺口。
27. 已补齐 Tauri 下 `initService` 的首次服务密钥生成与宿主持久化，服务初始化不再依赖旧配置里预先存在 `serviceAuthKey`。
28. 已补齐 `createHeapSnapshot` 的 Tauri 宿主诊断快照输出，调用该通道时会在宿主运行目录生成 `*.heapsnapshot.json` 文件，而不是继续静默占位。
29. 已补齐 `getIconDataURL` 的多平台原生图标提取实现，连接页和相关卡片不再只能回退默认图标。
30. 已补齐 `sysProxy.settingMode = service` 的 Tauri 命令路径接入，系统代理命令会透传 `--only-active-device` 标志，不再被宿主直接拦截。
31. 已将 Tauri 流量历史从渲染层 `localStorage` / `sessionStorage` 迁到宿主持久化，`recordTrafficSample` / `getTrafficStats` / `clearTrafficStats` 已改走宿主 `traffic-stats.json`。
32. 已接入 Tauri 官方 `global-shortcut` 插件，`registerShortcut` 不再固定返回占位成功；设置页配置会注册真实宿主全局快捷键，并在启动时按当前配置恢复。

关键位置：

1. `src/renderer/src/api/desktop.ts`
2. `src/renderer/src/api/app.ts`
3. `src/renderer/src/App.tsx`
4. `src/renderer/src/components/providers.tsx`
5. `src/renderer/src/main.tsx`
6. `src/tauri-web/main.tsx`
7. `src/tauri-web/index.html`
8. `src/tauri-web/floating.html`
9. `src/tauri-web/traymenu.html`
10. `vite.tauri.config.ts`
11. `src/renderer/src/assets/main.css`
12. `src/renderer/src/assets/floating.css`
13. `src/renderer/src/assets/traymenu.css`

### 2.2 Tauri 宿主

已完成：

1. `src-tauri` 已建立独立 Rust 宿主。
2. Tauri 前端产物可通过 `beforeBuildCommand` 构建并供宿主加载。
3. 宿主已实现统一 `desktop_invoke` 命令入口。
4. 当前共享 IPC invoke 通道覆盖已经做到 `163 / 163`。

注意：

1. `163 / 163` 代表“命令入口已覆盖”，不代表“所有能力已达 Electron 等价”。
2. 其中一部分系统能力仍是稳定占位或最小兼容实现。

关键位置：

1. `src-tauri/src/main.rs`
2. `src-tauri/tauri.conf.json`
3. `src-tauri/Cargo.toml`

### 2.3 配置、订阅、覆写、主题、运行时文件

已完成：

1. 应用配置、受控 Mihomo 配置、Profile、Override 已迁到 Tauri 宿主持久化。
2. 主题文件和运行时文本文件也已迁到 Tauri 宿主持久化。
3. 前端不再主要依赖 `localStorage` 维护这几类核心状态。

关键位置：

1. `src/renderer/src/utils/profile-ipc.ts`
2. `src/renderer/src/utils/override-ipc.ts`
3. `src/renderer/src/utils/file-ipc.ts`
4. `src/renderer/src/utils/theme-ipc.ts`
5. `src/renderer/src/hooks/use-app-config.tsx`
6. `src/renderer/src/hooks/use-profile-config.tsx`
7. `src/renderer/src/hooks/use-override-config.tsx`
8. `src/renderer/src/hooks/use-controled-mihomo-config.tsx`

### 2.4 Mihomo 主链路

已完成：

1. Tauri 宿主已支持 `restartCore`，并能写入运行时配置到宿主工作目录。
2. 已支持读取 `version`、`configs`、`rules`、`proxies`、`providers`。
3. 已支持策略组切换、测速、DNS 查询、Provider 更新。
4. 已支持连接关闭、全部连接关闭、规则禁用切换。
5. 已支持基础升级相关命令和最新版本检查。
6. 已建立 Tauri 侧 WebSocket 事件桥，向前端转发 `traffic` / `memory` / `logs` / `connections`。
7. 已补跨窗口事件广播，主窗口、悬浮窗、托盘菜单可以复用同一组状态事件。

关键位置：

1. `src-tauri/src/main.rs`
2. `src/renderer/src/utils/mihomo-ipc.ts`
3. `src/shared/ipc/on-channels.ts`

### 2.5 WebDAV

已完成：

1. Tauri 宿主已支持 WebDAV 备份。
2. 已支持列出备份。
3. 已支持恢复备份。
4. 已支持删除备份。

说明：

1. 当前实现基于 Tauri 宿主自己的存储根目录打包恢复，不是复用 Electron 的旧目录结构。

### 2.6 工具页与网络工具

已完成：

1. 本机 IP 查询。
2. 单个 IP 归属地查询。
3. 批量 IP 归属地查询。
4. HTTP GET。
5. 连通性测试。
6. 流媒体解锁检测。
7. `testRuleMatch` 基础宿主实现。

### 2.7 多入口页面、托盘与悬浮窗基础宿主逻辑

已完成：

1. Tauri 前端已构建出 `index.html`、`floating.html`、`traymenu.html` 三个入口，其中主窗口入口已接入正式前端。
2. Tauri 主窗口已切到无原生装饰窗口，和现有前端自绘标题栏布局保持一致。
3. 宿主已加入基础悬浮窗创建逻辑。
4. 宿主已加入基础托盘图标创建逻辑。
5. 宿主已加入托盘菜单窗的基础创建/显示/隐藏逻辑。
6. 托盘点击与主窗口显示、托盘窗显示/隐藏已有基础联动代码。
7. 托盘弹窗已补齐主窗口切换、系统代理开关、TUN 开关、出站模式切换、悬浮窗开关、退出应用等基础快捷操作。
8. Tauri `triggerMainWindow` 已改成与 Electron 对齐的显示/隐藏切换语义，悬浮窗点击不会再退化成只显示不隐藏。
9. Tauri 下 `trayIconUpdate` / `updateFloatingWindow` / `updateTrayMenu` 已接到真实宿主逻辑，不再是空发送通道。
10. 已补齐悬浮窗位置持久化，重启后会恢复上次位置。
11. 已新增 Windows / Linux 原生托盘菜单代码路径，右键基础菜单项已改由宿主 `Menu` 承接，不再继续复用 `traymenu` 自定义窗口。

注意：

1. 这一部分目前完成的是“基础能力闭环”，不是 Electron 版本复杂动态托盘菜单的等价迁移。
2. Windows / Linux 下原生托盘菜单当前只补了稳定基础项，没有复刻 Electron 的动态分组、订阅和目录操作全量菜单。
3. 托盘右键崩溃问题当前只完成了代码路径替换与编译验证，尚未做实机回归，不能写成“已确认修复”。
4. 更大范围的 GUI 实机回归仍然需要在阶段 6 继续执行，但不再阻塞阶段 4 的开发交付完成判定。

### 2.8 阶段 6 首批收口

已完成：

1. `package.json` 默认开发、验证、构建脚本已切到 Tauri，不再默认走 Electron-Vite / electron-builder。
2. TypeScript 与 ESLint 基座已去掉 Electron 工具链依赖，前端类型检查不再依赖 `electron` 包提供基础类型。
3. GitHub Actions 自动构建和手动发布流程已改为从 `src-tauri/target/release/bundle` 收集 Tauri 产物。
4. README 已改写为 Tauri 默认工作流，并明确 Electron 旧目录当前仅作为迁移参考。
5. `src-tauri/tauri.conf.json` 的 bundle 资源已改为目录引用，避免 `extra/sidecar` 为空时 `cargo check` 被通配符前置条件误伤。
6. 已确认并修复 Tauri 样式链路的一个系统性缺口：`src/renderer/src/assets/main.css` 之前未显式扫描 `src/renderer/src/**/*.{ts,tsx}`，导致 renderer 中大量 Tailwind 类未进入 Tauri 主 CSS，界面会退化为方形输入框、黑色边框、间距和玻璃背景失真。
7. 已在 `src/renderer/src/assets/main.css` 增加 `@source '../**/*.{ts,tsx}';`，Tauri 主窗口样式编译范围已补齐到整个 renderer 源码树。
8. 已在 `src/renderer/src/assets/floating.css` 与 `src/renderer/src/assets/traymenu.css` 同步增加 `@source '../**/*.{ts,tsx}';`，悬浮窗和托盘弹窗不再沿用此前不完整的样式扫描范围。
9. 已为 Windows / Linux 托盘新增原生 `Menu` 路径，右键基础菜单项改为宿主菜单事件处理，避免继续依赖 `traymenu` 自定义窗口承接托盘右键。
10. 已将 Tauri 流量历史改为宿主 `traffic-stats.json` 持久化，前端不再在 Tauri 下使用浏览器存储维护小时/日流量与会话流量。
11. 已补齐 `getAppMemory` 的宿主返回值，统计页相关接口不再固定返回 `0`；`startMonitor` 也已改为刷新托盘显示状态的最小实现，不再是纯空操作。
12. 已按当前产品决策移除 `Sub-Store` 的 Tauri 前端入口、设置项与导入入口，不再把该功能继续作为迁移目标。

### 2.9 更新和打包

已完成：

1. Tauri 宿主已补齐 `downloadAndInstallUpdate` / `cancelUpdate` 的首版实现，设置页更新弹窗不再只依赖空宿主通道。
2. 当前更新链路会复用 Release `latest.yml` 清单解析版本、资产路径和 `sha512`，并在下载完成后做 SHA-512 校验。
3. Windows 下已支持下载 NSIS / MSI 更新包后直接启动安装器；macOS / Linux 下已补齐按安装包类型打开文件的首版落地。
4. `src-tauri/Cargo.toml` 与 `src-tauri/tauri.conf.json` 版本号已对齐到 `3.1.0`，避免 Tauri 运行时版本、打包产物版本和前端更新判断继续错位。

## 3. 当前验证结果

以下验证在当前工作区已实际跑通：

1. `cargo check --manifest-path src-tauri/Cargo.toml`
2. `corepack pnpm run typecheck:web`
3. `corepack pnpm run build:tauri-web`
4. `corepack pnpm run tauri:build`
5. `corepack pnpm run lint:ci`
6. `corepack pnpm run verify`

补充说明：

1. 已确认 `corepack pnpm run build:tauri-web` 产物重新生成主样式文件，`dist-tauri/assets` 下可见主窗口、悬浮窗、托盘菜单 CSS。
2. 这次修复解决的是“样式编译链缺失导致的界面退化”，不代表 Tauri GUI 已完成肉眼回归。
3. 已确认修复前后的 Tauri 主 CSS 体积明显变化，主窗口样式产物约从 `233 KB` 增长到 `333 KB`，可作为“renderer 样式类此前存在大面积漏编译”的直接证据。
4. 已确认 `cargo check --manifest-path src-tauri/Cargo.toml` 和 `corepack pnpm run typecheck:web` 在原生文件对话框改动后仍通过。
5. 已确认 `cargo check --manifest-path src-tauri/Cargo.toml` 和 `corepack pnpm run typecheck:web` 在主题导入、`copyEnv` 宿主实现补齐后仍通过。
6. 已确认 `cargo check --manifest-path src-tauri/Cargo.toml` 和 `corepack pnpm run typecheck:web` 在 `relaunchApp` 宿主实现补齐后仍通过。
7. 已确认 `cargo check --manifest-path src-tauri/Cargo.toml` 和 `corepack pnpm run typecheck:web` 在开机自启宿主实现补齐后仍通过。
8. 已确认 `cargo check --manifest-path src-tauri/Cargo.toml` 和 `corepack pnpm run typecheck:web` 在 Windows 权限注册/取消注册闭环补齐后仍通过。
9. 已确认 `cargo check --manifest-path src-tauri/Cargo.toml` 和 `corepack pnpm run typecheck:web` 在 macOS / Linux 开机自启宿主实现补齐后仍通过。
10. 已确认 `cargo check --manifest-path src-tauri/Cargo.toml` 和 `corepack pnpm run typecheck:web` 在 `checkUpdate` 宿主实现补齐后仍通过。
11. 已确认 `cargo check --manifest-path src-tauri/Cargo.toml` 和 `corepack pnpm run typecheck:web` 在 macOS / Linux 内核授权宿主实现补齐后仍通过。
12. 已确认 `cargo check --manifest-path src-tauri/Cargo.toml` 和 `corepack pnpm run typecheck:web` 在 `alert` / `findSystemMihomo` 宿主实现补齐后仍通过。
13. 已确认 `cargo check --manifest-path src-tauri/Cargo.toml` 和 `corepack pnpm run typecheck:web` 在 `getGistUrl` 宿主实现补齐后仍通过。
14. 已确认 `cargo check --manifest-path src-tauri/Cargo.toml` 和 `corepack pnpm run typecheck:web` 在 macOS `setDockVisible` 宿主实现补齐后仍通过。
15. 已确认 `cargo check --manifest-path src-tauri/Cargo.toml` 和 `corepack pnpm run typecheck:web` 在网络健康监控宿主实现补齐后仍通过。
16. 已确认 `cargo check --manifest-path src-tauri/Cargo.toml` 和 `corepack pnpm run typecheck:web` 在 `getProviderStats` / `clearProviderStats` 宿主实现补齐后仍通过。
17. 已确认 `cargo check --manifest-path src-tauri/Cargo.toml` 在 macOS / Linux 原生文件打开/保存对话框补齐后仍通过。
18. 已确认 `cargo check --manifest-path src-tauri/Cargo.toml` 和 `corepack pnpm run typecheck:web` 在 Tauri 下最初的流量历史与清空统计功能补齐后仍通过。
19. 已确认 `src/renderer/src` 中除 `src/renderer/src/api/desktop.ts` 适配层外，不再出现 `window.electron` / `window.api` 直连。
20. 已确认 `src/renderer/src/utils/mihomo-ipc.ts` 中已不存在 `Tauri Demo` / 假数据回退逻辑。
21. 已确认 `cargo check --manifest-path src-tauri/Cargo.toml` 和 `corepack pnpm run typecheck` 在阶段 4 的托盘快捷操作与主窗口切换语义补齐后仍通过。
22. 已确认默认脚本切换到 Tauri 后，`corepack pnpm run typecheck` 仍通过。
23. 已确认默认脚本切换到 Tauri 后，`corepack pnpm run lint:ci` 仍通过。
24. 已确认默认脚本切换到 Tauri 后，`corepack pnpm run build:tauri-web` 在非沙箱环境下仍通过。
25. 已确认默认脚本切换到 Tauri 且 `verify` 去掉资源下载步骤后，`corepack pnpm run verify` 在非沙箱环境下仍通过。
26. 已确认 `cargo check --manifest-path src-tauri/Cargo.toml` 和 `corepack pnpm run typecheck:web` 在 `initService` 首次密钥生成、`createHeapSnapshot` 宿主诊断快照、原生图标提取增强补齐后仍通过。
27. 已确认当前仓库自带的 `routex-service` CLI 已暴露 `--only-active-device` 全局参数，Tauri 宿主可以复用命令路径承接 `service` 模式系统代理设置。
28. 已确认阶段 4 追加的托盘通道落地、悬浮窗位置持久化、宿主点击语义对齐后，`corepack pnpm run build:tauri-web`、`corepack pnpm run tauri:build` 仍通过。
29. 已确认打包产物 `src-tauri/target/release/routex_tauri.exe` 可以启动且不会立即退出。
30. 已确认 `cargo check --manifest-path src-tauri/Cargo.toml`、`corepack pnpm run typecheck:web`、`corepack pnpm run build:tauri-web` 在阶段 5 的首版更新链路与版本号对齐后仍通过。
31. 已确认 `corepack pnpm run tauri:build` 在阶段 5 改动后仍通过，并生成 `3.1.0` 版本安装产物。
32. 已确认 Windows / Linux 原生托盘菜单代码路径接入后，`cargo check --manifest-path src-tauri/Cargo.toml` 与 `corepack pnpm run typecheck:web` 仍通过。
33. 已确认 Tauri 流量历史迁到宿主持久化后，`cargo check --manifest-path src-tauri/Cargo.toml` 与 `corepack pnpm run typecheck:web` 仍通过。
34. 已确认接入 `tauri-plugin-global-shortcut` 并补齐 `registerShortcut` 宿主实现后，`cargo check --manifest-path src-tauri/Cargo.toml`、`corepack pnpm run typecheck:web`、`corepack pnpm run verify` 仍通过。
34. 已确认 `getAppMemory` 宿主实现与 `startMonitor` 最小刷新实现接入后，`cargo check --manifest-path src-tauri/Cargo.toml` 与 `corepack pnpm run typecheck:web` 仍通过。

当前已成功生成 Windows 安装产物：

1. `src-tauri/target/release/bundle/msi/RouteX_3.1.0_x64_en-US.msi`
2. `src-tauri/target/release/bundle/nsis/RouteX_3.1.0_x64-setup.exe`


## 4. 当前仍未完成或仅为占位的部分

以下项目仍未达到 Electron 等价：

### 4.1 系统能力

阶段 3 的代码尾项已经补齐，当前剩余的是实机回归与兼容差异确认：

1. macOS `service` 模式系统代理和 `onlyActiveDevice` 虽已接到真实命令路径，但当前只做了代码与命令级确认，未做 macOS 实机验证。
2. `initService` 首次服务密钥初始化已补齐，但当前只做了编译和类型检查，未做真实服务安装/初始化回归。
3. 原生图标提取已补多平台实现，但还未做多平台样本回归，暂时不能写成“已达 Electron 等价”。
4. `createHeapSnapshot` 在 Tauri 下输出的是宿主诊断快照，不是 Electron 主进程 V8 heapsnapshot 等价格式。

### 4.2 托盘与悬浮窗

当前状态：

1. 基础多窗口、托盘入口、托盘弹窗、悬浮窗显示关闭、主窗口显示隐藏切换都已补齐代码实现。
2. 阶段 4 完成标准对应的开发与构建验证已完成。
3. 尚未复刻 Electron 的复杂动态菜单、自定义托盘窗细节、完整平台差异处理。

### 4.3 更新链路

当前状态：

1. 已能打包，并已将 Tauri 宿主版本与打包版本对齐到 `3.1.0`。
2. 已能检查新版本，并已补齐自动下载、取消下载、SHA-512 校验和启动安装器的首版宿主链路。
3. 当前更新方案仍依赖现有 `latest.yml` 清单和 Release 资产组织方式，尚未切到 Tauri 官方 updater / 签名发布链。
4. 尚未做真实更新安装回归；macOS / Linux 的资产命名、签名和发布流程也还未最终收口。

### 4.4 收口与清理

当前状态：已开始，完成首批默认链路收口。

1. 默认开发、验证、构建、CI 路径已切到 Tauri。
2. README / 发布工作流 / 迁移状态文档已同步更新。
3. Electron 旧目录、旧配置文件和过渡兼容代码仍保留在仓库中，尚未做物理删除。

### 4.5 当前明确未完成清单

按发布阻塞程度排序，当前仍未完成的是：

1. macOS / Linux 实机回归：覆盖系统代理 `service` 模式、首次服务初始化、文件对话框、原生图标提取、开机自启、权限授权。
2. GUI 手工回归：覆盖托盘点击、主窗口显示隐藏、悬浮窗显示关闭、托盘快捷操作、托盘右键行为、跨平台行为差异，以及与 Electron 版的视觉一致性核对。
3. 更新发布链收口：决定是否切到 Tauri 官方 updater / 签名链路，并完成真实更新下载、安装、回滚验证。
4. Electron 旧目录与旧配置清理：删除 `src/main`、`src/preload` 及旧构建配置，压缩仅剩的过渡兼容层。

## 5. 当前风险判断

当前主要风险不是“无法编译”，而是“功能细节未做完整回归”。

主要风险点：

1. 托盘、悬浮窗、多窗口行为的基础链路已完成，但复杂交互和平台细节仍需阶段 6 做实机回归。
2. Windows / Linux 原生托盘菜单已补基础代码路径，但还未做右键崩溃复现关闭验证，也未恢复 Electron 的复杂动态菜单。
3. 阶段 3 的开发实现已经补齐，但 macOS / Linux 相关路径仍缺实机回归，当前还不能写成最终验收完成。
4. 自动更新首版已接入，但发布链、签名链和真实安装回归仍未收口。
5. 默认工作流已切到 Tauri，但仓库里仍保留 Electron 旧目录和旧配置文件，阶段 6 还没有完全结束。
6. 已确认 Tauri 曾存在 renderer 样式类漏编译问题，虽然当前扫描范围已补齐，但仍需要继续做 GUI 目测回归，确认不存在其它运行时视觉差异或覆盖链问题。
7. macOS / Linux 原生文件对话框、系统代理 service 模式、图标提取都已补齐宿主代码路径，但当前只做了编译级验证，尚未做对应平台的真实环境回归。
8. macOS / Linux 的开机自启与内核授权虽然已有宿主实现，但当前也只做了编译级验证，尚未做对应平台的真实环境回归。

## 6. 对照迁移文档的阶段判断

### 阶段 0：前端去 Electron 化

判断：已完成。

原因：

1. 主体业务代码已经通过桥接层访问桌面能力。
2. 当前 `window.electron` / `window.api` 只保留在 `src/renderer/src/api/desktop.ts` 适配层，不再散落在业务页面、store、hooks 中。

### 阶段 1：搭建 Tauri 宿主和主窗口

判断：已完成。

原因：

1. 宿主、主窗口、前端构建、配置读写已通。
2. 类型检查、构建和打包已通过。

### 阶段 2：迁移 Mihomo 能力

判断：已完成。

原因：

1. 启停、配置、规则、代理、Provider、连接、事件桥已经接通。
2. 前端已移除 `Tauri Demo` / 假数据回退，这条链路不再靠演示数据兜底。

### 阶段 3：迁移系统能力

判断：开发实现已完成，待跨平台实机回归。

原因：

1. 文件读写、主题、WebDAV、系统代理执行路径、服务控制、权限/提权任务、网络检测、图标提取、诊断快照、部分工具页网络能力都已补齐真实宿主实现。
2. 当前剩余的不是新的开发尾项，而是 macOS / Linux 相关路径的实机回归，以及与 Electron 兼容差异的最终确认。

### 阶段 4：迁移托盘和悬浮窗

判断：已完成。

原因：

1. Tauri tray、traymenu、floating 三条代码路径都已接通。
2. 托盘弹窗已能触发主窗口切换、系统代理、TUN、出站模式、悬浮窗和退出应用等基础操作。
3. Tauri 下托盘相关发送通道和悬浮窗位置持久化已补齐，打包产物可启动。
4. Electron 版复杂托盘体验和更大范围 GUI 回归转入阶段 6，不再算阶段 4 阻塞。

### 阶段 5：迁移更新和打包

判断：开发实现已完成，待发布链与实机回归收口。

原因：

1. `tauri:build` 已通过并生成 `3.1.0` 版本安装包。
2. Tauri 宿主已补齐更新检查后的下载、取消、校验和启动安装器首版链路。
3. 当前仍未切换到最终的 Tauri 官方 updater / 签名发布方案，也未完成真实更新安装回归。

### 阶段 6：回归和收口

判断：已开始，完成首批默认链路收口。

## 7. 建议的下一步

阶段 0 / 1 / 2 已收口后，如果继续按当前文档推进，优先级建议如下：

1. 先做阶段 3 实机回归：重点验证 macOS `service` 模式系统代理、首次服务初始化、原生图标提取和文件对话框。
2. 在阶段 6 继续做 GUI 手工回归：覆盖托盘点击、主窗口切换、悬浮窗显示关闭、托盘快捷操作、托盘右键行为、平台差异，以及与 Electron 版的视觉一致性。
3. 完成阶段 5 收口：确定最终 updater / 签名 / 资产组织方案，并做真实安装回归。
4. 继续阶段 6：删除 Electron 旧目录 / 旧配置并压缩过渡兼容层。

## 8. 当前一句话状态

当前 Tauri 迁移已经完成阶段 0 / 1 / 2 / 4，阶段 3 的开发实现也已补齐，阶段 6 已完成首批默认链路收口；距离“替代 Electron 主版本”还差跨平台实机回归、更新链路迁移和最终物理清理。
