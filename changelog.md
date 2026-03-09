## V1.8.0

### UI 重构 (Fusion Design)
- **全新视觉语言**：引入 "Fusion Design" 设计理念，全屏 Mesh Gradient 背景，极致的 Glassmorphism 毛玻璃效果。
- **界面焕新**：
  - **侧边栏**：Deep Glass 风格侧边栏，搭配动态悬浮胶囊导航。
  - **Dashboard**：重新设计的 3 行网格布局，信息呈现更高效美观。
  - **窗口控制**：新增 MacOS 风格“红绿灯”窗口控制按钮，不仅美观且符合直觉。

### 性能优化
- **页面响应**：实现侧边栏 Keep-Alive 机制，主功能页面切换零延迟，体验如原生般丝滑。
- **动画流畅度**：优化大量微交互与转场动画，移除卡顿。

### 功能增强
- **可视化升级**：
  - 新增 `TopologySpeedCard`，将网络拓扑动画与实时速率图表融合。
  - 优化 `RunningStatusCard` 与 `TrafficSummaryCard`，数据展示更直观。
- **细节打磨**：
  - 优化卡片边框在不同主题下的可见性。
  - 统一 Rules 与 Profiles 页面的视觉风格。
