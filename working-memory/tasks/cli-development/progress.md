# CLI Development Progress

**更新**：2026-09-17 09:35

## 当前阶段

**长运行 tick 1 完成** —— 链接锚点闭环。

## 本轮已完成

- ✅ `INDEX_REF_PREFER_ID` 警告规则
- ✅ `collab index` 归一化已有行（保留人工列）
- ✅ 真库迁移：65 warnings → **0 issues**
- ✅ commit：`collab-cli` `cd69a65` · `collaboration` `54a37ea`

## 进行中

- 🔄 长运行 → **真 CI**（下一 tick）

## 已知副作用

- `patterns/_index.md` 主表补了 32 行空白列（extra 分区表仍在）—— 待人工填名称或下轮整理

## 下一步

1. GitHub Actions / 本地 CI 跑 `npm run check` + 真库 `collab validate`
2. AGENTS.md 症状表链接仍多为文件名锚（非 `_index`，不触发规则）—— 可选后续
