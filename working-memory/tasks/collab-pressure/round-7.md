# 第 7 轮暴露点

**日期**：2026-09-17 ｜ **场景**：`collab new` → `collab index` → `collab commit` 发布链

| # | 暴露点 | 预期 |
| :-- | :--- | :--- |
| C1 | new + index → commit 成功，git log 可查 | 创建到入库闭环 |
| C2 | new 未 index → commit 被 validate 拦住 | 门禁在 commit 生效 |
| C3 | commit 后 validate 仍全绿 | 提交不破坏一致性 |
| C4 | commit 只含 COLLABORATION 变更 | D3 在链路末端仍成立 |
