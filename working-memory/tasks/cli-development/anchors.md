# Anchors: CLI Development

**更新**：2026-09-16

> 当前任务的关键约束。**每次新对话必读**。

## 不可遗忘的约束

1. **流程**：遵守 [[A10-review-前置原则]]（Spike → 规格 → 测试 → 实现 → Review）。
2. **边界**：`src/domain/` 不 import 第三方，也**不 import application**（S12）。
3. **反馈**：每次复杂交互附知识笔记（[[A12-知识笔记返回]]）。
4. **上下文**：按需读取，不全量（[[A16-上下文预算法]]）。
5. **校验**：产物必须通过 `collab validate`（门禁用 `contentRules`，不含索引规则）。
6. **基座**：动目录 / kind / id 语法 = 破坏性变更 → **ADR + 迁移脚本 + validate 归零**。
   权威在 `collaboration/meta/base-contract.md`。

## 当前阶段

**8 个命令全部落地**：`new`（含 `--dry-run`）· `index` · `validate` · `commit` · `push`
· `apply` · `catalog` · `fix`。

全量门禁：**522 tests / 37 files 绿**，lint 0 error。

## 下一个动作

**`collab parse`**（A17 文本 → `bundle.json`）—— 规格已写但 **6 个决策点未拍板**，
见 `tasks/collab-parse/spec.md`。`apply` 是落盘的一半，`parse` 是进料的另一半。

## 写代码时的三条硬约束（本会话被工具抓到过两次）

1. **工具生产的产物必须符合规则**（`renderIndex` 曾渲染 id 而规则禁 id；`collab new` 曾不写 `aliases`）。
2. **规则只有一份**：校验 / 渲染 / 修复都复用同一函数（如 `refersToIdentity`、`idIsAlias`）。
3. **生成物由生成它的那一侧负责刷新**（`apply` 落盘后自动刷 `catalog.json`）。

## （历史）2026-09-14 的决策

> 已结清，仅存档。当时标"待实现"的均已生效。

| 日期 | 决策 | 状态 |
| :--- | :--- | :--- |
| 2026-09-14 | `ExitCode` 常量替代魔法数字 | ✅ 生效中 |
| 2026-09-14 | `useTestWorkspace` 封装通用 Arrange | ✅ 生效中 |
| 2026-09-14 | 命令 fixture 用具名工厂 | ✅ 生效中 |
| 2026-09-14 | Act / Assert 永不封装 | ✅ 生效中 |
| 2026-09-14 | CLI 采用渐进式 DDD | ✅ 生效中 |
| 2026-09-14 | 分两批回归（先测试后代码） | ✅ 批次 1 挂起 / 批次 2 完成 |
