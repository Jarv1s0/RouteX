# 实施计划

## 目标

修复 `dependabot alert #35`，消除 `webdav` 间接引入的 `fast-xml-parser` 高危漏洞 `GHSA-8gc5-j5rx-235r` / `CVE-2026-33036`。

## 实施步骤

1. 将 `pnpm.overrides.fast-xml-parser` 从宽泛下限调整为明确的安全版本范围，确保解析结果不再落到 `5.5.5` 及以下。
2. 执行锁文件刷新，使 `pnpm-lock.yaml` 解析到已修复版本。
3. 运行 `pnpm audit --json` 验证漏洞已消除。

## 风险评估

- `webdav@5.8.0` 依赖声明为 `fast-xml-parser: ^4.5.1`，升级到 `5.5.6+` 仍处于同一主版本，兼容风险较低。
- 本次不改业务源码，主要影响依赖解析结果与构建产物一致性。
