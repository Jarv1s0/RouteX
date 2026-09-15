# 更新日志

## v4.4.0

### 新增

- 适配 mihomo `v1.19.31`，支持 EasyTier 出站、EasyTier DNS、TUN MIPS 网络栈和 ZeroTier 固定身份配置。

### 优化

- 更新 mihomo 内核资源匹配规则，支持 `v1.19.31` 的 AMD64 和 LoongArch 发布资产。
- GitHub 自动构建和正式发布流程会固定本次构建使用的 mihomo 版本，并按内核版本隔离资源缓存。
- GitHub 自动构建和正式发布流程升级到 Node.js 24。

### 修复

- 升级 `js-yaml`、`vitest`、`adm-zip` 等依赖，修复 7 项 Dependabot 安全告警。
- 升级 `rustls` 及其加密依赖，修复 TLS 1.3 握手消息加密级别校验漏洞。
