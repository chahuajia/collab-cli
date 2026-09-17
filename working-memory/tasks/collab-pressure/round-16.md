# 第 16 轮暴露点

**日期**：2026-09-17 ｜ **场景**：`apply --json` 机器可读契约（含 validate-failed）

| # | 暴露点 | 预期 |
| :-- | :--- | :--- |
| C1 | 落盘后 content validate 失败 → JSON `validate-failed` | 脚本可解析 |
| C2 | JSON issues 含 `DEAD_LINK` code | 与 human 模式同判据 |
| C3 | 文件仍落盘（E12 不回滚） | JSON 模式同样 |
| C4 | 后续 `validate --json` 仍报同一 issue | 状态一致 |
