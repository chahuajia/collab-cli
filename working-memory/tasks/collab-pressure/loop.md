# Collaboration 复杂场景压测 — 长运行

**更新**：2026-09-17 11:19 ｜ **间隔**：800ms（**one-shot**）｜ battery-pressure 已迁出 evolutionary

## 句柄

`AGENT_LOOP_WAKE_collab-pressure`

## 调度规则

- **禁止** `while ($true)` 空转 —— 上一轮 3s 教训
- 每 tick **做完可验证增量** → `Start-Sleep 1` → 发 wake
- 无增量 → 写阻塞，**拉长**间隔或停

## 每 tick

1. `node working-memory/check-freshness.mjs`
2. 读 `spec.md` + 本文件 + 最近 `round-*-report.md`
3. 写下一 `round-N.md` 暴露点 → 实现 → 报告
4. commit + 刷新 WM（不 push）

## 进度

| 轮 | 状态 |
| :-- | :--- |
| 1 | ✅ index --dry-run |
| 2 | ✅ MCP validate + dir 真库 113/0 |
| 3 | ✅ apply 派生链 + commit 门禁 |
| 4 | ✅ parse + apply 联动 |
| 5 | ✅ fix ↔ validate 规则对齐 |
| 6 | ✅ new → index → validate 工作流 |
| 7 | ✅ new → index → commit 发布链 |
| 8 | ✅ new → index → commit → push 全链 |
| 9 | ✅ catalog ↔ CATALOG_STALE 门禁 |
| 10 | 待：下一复杂场景 |

## 停止

「停止长运行」→ 不 arm 下一次 wake
