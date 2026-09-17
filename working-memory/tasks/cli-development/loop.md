# CLI 长运行循环

**更新**：2026-09-17 09:35 ｜ **tick**：1 完成

## 循环句柄

`AGENT_LOOP_WAKE_cli-a4`

## 每 tick 必做

1. `node working-memory/check-freshness.mjs`
2. 读 `README.md` + 本文件 + `progress.md`
3. 推进 A4（**真 CI** 为下一焦点），**不要 push**
4. 有可验证增量 → 本地 commit + 刷新 WM HEAD
5. 无增量 → 写阻塞原因，不空转

## tick 1 摘要

| 交付 | 结果 |
| :--- | :--- |
| `INDEX_REF_PREFER_ID` | validate 警告 |
| `collab index` normalize | 65→0 warnings |
| 真库 | `54a37ea` |

## tick 2 焦点

**真 CI**：`.github/workflows` 跑 `npm run check`；可选挂 collaboration validate。

## 停止

用户说「停止长运行」→ 杀 loop shell，不再 arm wake。
