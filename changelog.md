# 更新日志

## v4.4.0

### 新增

- 适配 mihomo `v1.19.31`，支持 EasyTier 出站、EasyTier DNS、TUN MIPS 网络栈和 ZeroTier 固定身份配置。

### 优化

- 更新 mihomo 内核资源匹配规则，支持 `v1.19.31` 的 AMD64 和 LoongArch 发布资产。
- GitHub 自动构建和正式发布流程会固定本次构建使用的 mihomo 版本，并按内核版本隔离资源缓存。
