# 更新日志

## v3.2.1

### ⚠️ 注意

- `v3.2.0` 是最后一个基于 Electron 的正式版本。
- 下一个大版本 `v4.0.0` 将迁移到 Tauri。
- 服务鉴权已切换到新的 `service-auth.json` 存储和 Auth V2 机制；旧版 `serviceAuthKey` 配置不再兼容，使用系统服务模式的用户升级后需要重新初始化服务。

### 修复

- 修复 GitHub Actions 打包拉取新版 `routex-service` 后，系统代理仍调用旧版根级 `proxy`/`pac`/`disable` 命令导致开启系统代理失败的问题。