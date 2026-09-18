# 第 17 轮暴露点

**日期**：2026-09-17 ｜ **场景**：修复 round-16 gap —— `apply --json` 单次 JSON 输出

| # | 暴露点 | 预期 |
| :-- | :--- | :--- |
| C1 | validate 失败 → stdout **仅一段** `validate-failed` JSON | 脚本可 JSON.parse 整段 stdout |
| C2 | validate 成功 → stdout **仅一段** `applied` JSON | 对称 |
| C3 | human 模式仍先 applied 再 validate 文案 | 不改 UX |
| C4 | round-16 回归用例更新为单 JSON | 拦截 gap |
