# 压测第 3 轮：apply 冲突 + catalog/index 派生链

**日期**：2026-09-17 ｜ **复杂点**：`apply` 只刷 catalog、不刷 index；content 门禁 vs commit 全量 validate

## 暴露点

| # | 检验什么 |
| :-- | :--- |
| **C1** | `meta/base-contract`：catalog 由 apply 刷新；index 须 `--index` |
| **C2** | apply 内 validate 用 `contentRules` → 无 index 也能 exit 0 |
| **C3** | 随后 `collab validate` / `--commit` 全量规则 → `MISSING_FROM_INDEX` |
| **C4** | `replace` + stale `base_sha256` 预检拒绝（E8，与派生链正交） |
