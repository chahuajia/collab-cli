# Collaboration 复杂场景压测 — 长运行

**更新**：2026-09-17 09:58 ｜ **间隔**：1s（**one-shot**，每 tick 结束后再 arm）

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
| 3 | 待：apply 派生链冲突 |

## 停止

「停止长运行」→ 不 arm 下一次 wake
