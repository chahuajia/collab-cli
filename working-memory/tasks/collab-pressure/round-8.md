# 第 8 轮暴露点

**日期**：2026-09-17 ｜ **场景**：完整发布链 `new` → `index` → `commit` → `push`

| # | 暴露点 | 预期 |
| :-- | :--- | :--- |
| C1 | 全链 → `push --dry-run` 预览、不推送 | D6 在链路末端 |
| C2 | 全链 → `push` 远程收到 commit | 端到端发布 |
| C3 | `--no-validate` 提交坏状态 → push 被拦 | push 二次 validate 门禁 |
| C4 | 无新 commit → push up-to-date | D5 在链后仍成立 |
