# 订阅流量统计功能需求文档

## 功能概述

为每个订阅（proxy-provider）按天统计流量使用情况，帮助用户了解各个订阅的流量消耗，特别适用于有流量限制的订阅服务。

## 用户故事

**作为** 使用有流量限制订阅的用户  
**我想要** 查看每个订阅每天的流量使用情况  
**以便** 了解哪些订阅消耗了多少流量，合理管理订阅流量配额

## 功能需求

### 1. 数据收集

#### 1.1 统计维度
- **订阅维度**: 按订阅名称（proxy-provider name）统计
- **时间维度**: 按天统计（格式: `YYYY-MM-DD`）
- **流量维度**: 分别统计上传和下载流量

#### 1.2 统计范围
- **包含**: 所有通过订阅节点的连接流量
- **排除**: 
  - DIRECT 直连流量
  - chains 为空的连接
  - chains[0] 为 "DIRECT" 的连接
  - 不属于任何订阅的节点（如手动添加的节点）

#### 1.3 节点到订阅的映射
- 从 `mihomoProxyProviders()` API 获取所有订阅及其包含的节点列表
- 建立节点名称到订阅名称的映射关系：`Map<proxyName, providerName>`
- 当连接使用某个节点时，通过映射找到对应的订阅
- 定期更新映射关系（每 10 秒或订阅更新时）

#### 1.4 数据结构
```typescript
interface ProviderDailyStats {
  provider: string     // 订阅名称
  date: string         // 日期 "YYYY-MM-DD"
  upload: number       // 上传字节数
  download: number     // 下载字节数
}

interface ProviderStatsData {
  daily: ProviderDailyStats[]  // 保留最近 30 天数据
  lastUpdate: number           // 最后更新时间戳
}

// 节点到订阅的映射
type ProxyToProviderMap = Map<string, string>
```

### 2. 数据持久化

#### 2.1 存储位置
- 文件路径: `{dataDir}/provider-stats.json`
- 与现有 `traffic-stats.json` 并列存储

#### 2.2 存储策略
- 自动保存: 每 5 秒延迟保存（避免频繁写入）
- 数据清理: 自动保留最近 30 天数据
- 应用启动时加载历史数据

### 3. 用户界面

#### 3.1 统计页面新增标签
在 `src/renderer/src/pages/stats.tsx` 中添加新的 Tab:
- 标签名称: "订阅统计"
- 位置: 在现有 "实时/24小时/7天/30天" 标签组后新增

#### 3.2 数据展示
**表格视图** (优先实现):
- 列: 订阅名称 | 今日上传 | 今日下载 | 今日总计 | 7天总计 | 30天总计
- 排序: 默认按今日总流量降序
- 支持按各列排序
- 显示订阅的流量配额信息（如果有 subscriptionInfo）

**图表视图** (可选):
- 柱状图: 展示各订阅流量对比
- 折线图: 展示单个订阅的历史趋势

#### 3.3 交互功能
- 点击订阅名称: 展开查看该订阅的详细历史数据
- 筛选功能: 支持按订阅名称搜索
- 清除功能: 复用现有的"清除统计数据"按钮，同时清除订阅统计
- 流量对比: 显示已用流量 vs 订阅总流量（如果有配额信息）

### 4. 技术实现

#### 4.1 后端实现
**文件**: `src/main/resolve/providerStats.ts`
- `loadProviderStats()`: 加载历史数据
- `saveProviderStats()`: 保存数据到文件
- `updateProxyToProviderMap()`: 更新节点到订阅的映射关系
- `updateProviderStats(proxy: string, upload: number, download: number)`: 更新统计
- `getProviderStats()`: 获取统计数据
- `clearProviderStats()`: 清除所有统计数据

#### 4.2 数据收集方式
**方案**: 监听连接数据变化 + 节点映射
1. 定期调用 `mihomoProxyProviders()` 获取订阅和节点列表
2. 建立节点名称到订阅名称的映射 Map
3. 在主进程中监听 `mihomoConnections` 事件
4. 对比前后两次连接数据，计算流量增量
5. 从 `connection.chains[0]` 获取节点名称
6. 通过映射找到对应的订阅名称
7. 调用 `updateProviderStats()` 更新该订阅的统计

#### 4.3 IPC 接口
**新增接口**:
- `getProviderStats()`: 获取订阅统计数据
- `clearProviderStats()`: 清除订阅统计数据

**修改文件**:
- `src/main/utils/ipc.ts`: 添加 IPC 处理器
- `src/renderer/src/utils/ipc.ts`: 添加渲染进程调用接口

#### 4.4 前端实现
**修改文件**: `src/renderer/src/pages/stats.tsx`
- 添加新的 Tab: "订阅统计"
- 添加状态管理: `providerDailyData`, `providerInfo`
- 实现表格组件展示订阅统计
- 定时刷新数据（5秒间隔）
- 显示订阅配额信息（从 `mihomoProxyProviders` 获取）

## 验收标准

### 功能验收
- [ ] 能够正确统计每个订阅的每日流量
- [ ] DIRECT 直连流量不被统计
- [ ] 不属于任何订阅的节点流量不被统计
- [ ] 节点到订阅的映射关系正确且及时更新
- [ ] 数据能够持久化保存并在重启后恢复
- [ ] 统计页面能够正确展示订阅统计数据
- [ ] 支持按不同维度排序查看
- [ ] 清除统计数据功能同时清除订阅统计
- [ ] 显示订阅的流量配额信息（如果有）

### 性能验收
- [ ] 数据收集不影响连接性能
- [ ] 文件保存采用延迟策略，避免频繁 I/O
- [ ] 自动清理超过 30 天的历史数据
- [ ] UI 渲染流畅，无卡顿

### 用户体验验收
- [ ] 界面布局与现有统计页面风格一致
- [ ] 数据展示清晰易读
- [ ] 支持流量单位自动转换（B/KB/MB/GB/TB）
- [ ] 操作响应及时，无明显延迟

## 实现阶段

### Phase 1: 核心功能（必需）
1. 创建 `providerStats.ts` 模块
2. 实现节点到订阅的映射逻辑
3. 实现数据收集逻辑
4. 添加 IPC 接口
5. 实现基础表格展示

### Phase 2: 增强功能（可选）
1. 添加图表可视化
2. 添加订阅详情展开
3. 添加筛选和搜索功能
4. 显示流量配额对比
5. 优化性能和用户体验

## 技术风险

### 风险 1: 节点映射准确性
**描述**: 节点名称可能重复，或者订阅更新后映射关系未及时更新  
**缓解**: 
- 定期刷新映射关系（每 10 秒）
- 监听订阅更新事件，立即刷新映射
- 如果节点属于多个订阅，统计到第一个匹配的订阅

### 风险 2: 数据收集准确性
**描述**: 连接数据变化频繁，可能出现流量统计不准确  
**缓解**: 
- 使用增量计算方式
- 处理连接重置情况（upload/download 变小）
- 添加日志记录异常情况

### 风险 3: 性能影响
**描述**: 频繁的数据更新和保存可能影响性能  
**缓解**:
- 使用延迟保存策略（5秒）
- 内存中维护数据，减少文件读取
- 定期清理历史数据
- 映射关系缓存在内存中

### 风险 4: 数据一致性
**描述**: 应用异常退出可能导致数据丢失  
**缓解**:
- 定期自动保存
- 应用退出时强制保存
- 数据文件损坏时能够重新初始化

## 参考实现

### 现有代码参考
- 流量统计实现: `src/main/resolve/trafficStats.ts`
- 连接数据结构: `src/renderer/src/pages/connections.tsx`
- 统计页面布局: `src/renderer/src/pages/stats.tsx`
- 类型定义: `src/shared/types/controller.d.ts`

### 关键代码片段
```typescript
// 建立节点到订阅的映射
const proxyToProviderMap = new Map<string, string>()
const providers = await mihomoProxyProviders()
for (const [providerName, provider] of Object.entries(providers.providers)) {
  provider.proxies?.forEach(proxy => {
    proxyToProviderMap.set(proxy.name, providerName)
  })
}

// 从连接中提取订阅并统计
const proxyName = connection.chains?.[0]
if (proxyName && proxyName !== 'DIRECT') {
  const providerName = proxyToProviderMap.get(proxyName)
  if (providerName) {
    updateProviderStats(providerName, uploadDelta, downloadDelta)
  }
}
```

## 估算工作量

- **Phase 1 核心功能**: 5-7 小时
  - 后端实现（含映射逻辑）: 3-4 小时
  - IPC 接口: 1 小时
  - 前端表格: 1-2 小时
  
- **Phase 2 增强功能**: 2-3 小时
  - 图表可视化: 1-2 小时
  - 流量配额显示: 0.5 小时
  - 交互优化: 0.5-1 小时

**总计**: 7-10 小时

## 后续优化方向

1. **流量预警**: 设置流量阈值，接近订阅限额时提醒
2. **导出功能**: 支持导出统计数据为 CSV
3. **对比分析**: 对比不同时间段的流量变化
4. **实时监控**: 显示当前正在使用的订阅及实时速度
5. **多订阅对比**: 同时对比多个订阅的流量使用情况
6. **自动切换建议**: 根据流量使用情况建议切换订阅
