# 开发流水账
## 2026-01-19
- 初始化 RouteX 项目上下文。
- 修复内核更新检查逻辑：
  - 区分 Alpha (Hash) 与 Stable (Semver) 的版本比对算法。
  - 修复切换内核版本时 `latestVersion` 状态残留导致的错误红点。
- 优化打包预处理：
  - 清理了 `extra/sidecar/meta-backup` 冗余目录 (约66MB)。
  - 重新恢复 `mihomo-alpha.exe` 到构建目录，确保安装包包含开发版内核，避免切换时无网络下载的问题。
