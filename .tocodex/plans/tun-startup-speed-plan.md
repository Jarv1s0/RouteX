---
created: 2026-04-24
reason: TUN 开关后虚拟网卡延迟 ~20s 才建立，分析根因并规划最优减速方案
---

# TUN 启动速度优化计划

## 已完成的基线修复（已合入 main.rs）

- `wait_for_core_ready` 轮询间隔从 200ms 降至 100ms
- TUN 模式超时上限从 20s 降至 15s，非 TUN 从 10s 降至 6s
- provider 等待改为非阻塞：超时只打 warning，不阻塞 restartCore 返回
- 增加 `[desktop.core_ready]` 日志，记录 controller 就绪耗时

---

## 问题链路（非 service 模式，elevated 权限）

```
点击 TUN 开关
  stop_core_process         ~100-200ms  (kill 旧进程 + Wintun 清理)
  check_runtime_profile     ~500ms-2s   (⚠️ 启动 mihomo -t 子进程做语法检查)
  spawn 新 mihomo           <100ms
  sleep(500ms)              500ms        (⚠️ 固定等待，不管进程是否已起来)
  wait_for_core_ready       3-15s        (等 Wintun 初始化完成 + controller 开放)
    └─ Wintun 初始化是真实物理耗时，无法消灭，只能更精准检测
```

真正无法消灭的部分：Wintun 驱动适配器初始化，属于内核级操作。

---

## 优化方案（按收益/风险/改动量排序）

### 方案 A：移除或加速 `check_runtime_profile`（mihomo -t 配置检查）

**当前代码位置**：[`main.rs:12275`](../src-tauri/src/main.rs)

**问题**：每次重启核心都要 `spawn mihomo -t` 做配置校验。这个子进程在 debug build 下启动慢，校验本身也需要 0.5-2s。

**优化选项**（选其一）：

**A1 — 配置哈希缓存跳过**（推荐）
- 保存上次成功校验的 config.yaml 内容哈希
- 如果新 config 与上次相同，直接跳过 `check_runtime_profile`
- 改动量：小，只在 `restart_core_process` 里加哈希比较逻辑
- 风险：极低，跳过时不影响启动；哈希不同时仍正常校验

**A2 — 异步并行校验**（较复杂）
- 先启动核心进程，同时异步运行 `-t` 校验
- 若校验失败则杀掉已启动的进程返回 Err
- 改动量：中
- 风险：需要处理竞态，稍复杂

**A3 — 完全移除 check_runtime_profile**
- 不再预先校验，直接启动
- 若配置有误，核心进程会快速退出（现有的 `try_wait` 逻辑会捕获）
- 风险：错误信息质量下降，不推荐

**建议实施 A1**。

---

### 方案 B：去掉 `sleep(500ms)` 固定等待，改为日志尾随检测

**当前代码位置**：[`main.rs:12349`](../src-tauri/src/main.rs)

**问题**：spawn 后固定 sleep 500ms 再 `try_wait`，浪费时间。如果进程崩了，检测要等满 500ms；如果进程正常，这 500ms 也是纯等待。

**优化方案**：
- 去掉 `sleep(500ms)`
- 改为短轮询：`try_wait` 轮询 5 次 × 50ms，发现进程存活则继续
- 同时可以开始 tail 日志文件，检测关键字（`start success`、`error`）

**改动量**：小
**风险**：极低，只是把固定等改为短轮询

---

### 方案 C：基于 mihomo 启动日志精确判断 TUN 就绪

**问题**：现在是用 HTTP `/rules` 接口轮询来判断 controller ready，间接反映"核心已完全启动"，但不能直接知道 TUN 网卡何时就绪。

**优化方案**：
- 核心启动后，同时在后台 tail 日志文件
- 监控关键日志行，例如：
  - `Start TUN listening` → TUN 初始化开始
  - `[TUN] start success` / `inbound [tun` → TUN 可用
  - 错误行 → 快速失败
- 一旦看到就绪日志，立刻中断 HTTP 轮询并返回
- 而不是傻等 HTTP controller 接口慢慢可用

**改动量**：中（需要后台 tail 线程和日志关键字匹配，但这方向上已有 `validate_runtime_start_log` 的基础）
**风险**：日志格式依赖 mihomo 版本，需要测试多个版本的日志格式

---

### 方案 D：热切换配置（不重启进程，只 PATCH config）

**问题**：开关 TUN 目前必须重启整个 mihomo 进程（因为 TUN 的 enable 状态是进程启动时读配置决定的，mihomo 没有 API 支持在运行时启停 TUN）。

**可行性**：经确认，mihomo 的 `/configs` PATCH API 支持部分配置热重载，但 **TUN enable/disable 不在支持热重载范围内**，因此热切换从协议层面行不通。

**结论**：暂不实施。

---

### 方案 E：使用 service 模式减少权限初始化开销

**当前状态**：
- `elevated` 模式（默认）：通过 Windows 任务计划程序 elevate 启动，有进程启动开销
- `service` 模式：高权限 `routex-service` 常驻，通过 named pipe 调 `/core/restart`

**service 模式的优点**：
- 核心 restart 不需要再走 schtasks elevate，减少一层进程启动开销
- Windows 下 Wintun 初始化快不了多少，但可以减少 ~500ms 的提权延迟

**改动量**：UI 引导用户开启 service 模式（已有后端支持）
**风险**：低，service 模式已完整实现

---

## 建议实施顺序

```
阶段 1（小改、立竿见影）：
  [x] 已完成：wait_for_core_ready 轮询优化
  [ ] B：去掉固定 sleep(500ms)，改为短轮询
  [ ] A1：config 哈希缓存跳过 check_runtime_profile

阶段 2（中等改动）：
  [ ] C：日志尾随检测 TUN 就绪关键字，早于 HTTP controller 就绪时返回

阶段 3（用户操作）：
  [ ] E：引导 Windows 用户切换到 service 模式
```

---

## 预期收益

| 优化项 | 能节省多少时间 |
|---|---|
| 已完成（轮询优化） | 去除人为等待；真实延迟仍取决于 Wintun 初始化 |
| B：去掉 sleep(500ms) | 节省 ~500ms |
| A1：跳过 config 检查 | 节省 ~500ms-2s（dev build 效果最明显） |
| C：日志检测 TUN 就绪 | 如果 Wintun 初始化完了但 HTTP controller 还没开，能额外节省 ~0-3s |
| E：service 模式 | Windows 下节省 ~200-500ms 提权延迟 |

**综合预期**：从"点击到 TUN 可用"的总时间，从目前 ~8-20s 缩短到 **~3-7s**（真实硬件取决于 Wintun 初始化速度，这部分无法进一步加速）。
