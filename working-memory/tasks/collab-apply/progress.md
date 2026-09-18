# collab apply Progress

**更新**：2026-09-16 11:10

## 当前阶段

**已实现** —— spec 的 E1-E13 验收场景全部有测试；全仓 32 文件 / 471 测试绿，lint 0 error。

## 已完成

- ✅ 领域层 `src/domain/apply/`：`normalizeBundlePath`（白名单 + 剥 `COLLABORATION/` 前缀）、`validateBundle`（路径 / 空内容 / 哈希）、`resolvePlan`（冲突）
- ✅ 边界层 `infrastructure/parsing/BundleParser.ts`（zod；`version` 用 `literal(1)`）
- ✅ 端口与实现：`ApplyWorkspace`（领域声明）/ `FileApplyWorkspace`（fs）
- ✅ 哈希按"注入的 How"处理：领域只声明 `ContentHasher`，生产实现在 `infrastructure/crypto/sha256.ts`
- ✅ 用例 `application/ApplyUseCase.ts`：**plan（不改盘）/ execute** 两段 —— `--dry-run` 因此不需要另写分支
- ✅ CLI `cli/commands/apply.ts`：`--dry-run` / `--index` / `--commit` / `--json`
- ✅ 复用既有逻辑：`cmdIndex` / `cmdCommit`（不重写）；validate 门禁用 `contentRules`
- ✅ 测试：领域 3 文件 + 边界 1 文件 + E2E 1 文件（28 条）

## 进行中

（空）

## 下一步（待定）

- **`collab parse`**（A17 文本 → `bundle.json`）—— `apply` 的另一半：现在"落盘"通了，"切分"还没通

## 遗留

- ⚠️ spec 的 4 个未决问题按**建议默认值**落地（不回滚 / `--commit` 默认关 / 允许 `inbox/` / `base_commit` 只记录）—— 需要用户确认
- ⚠️ 落地时新增第 5 个决策：门禁用 `contentRules`（内容规则，不含索引规则）—— 见 `decisions.md`
- ⏳ `apply` 不要求 `.md` 后缀（spec 未规定，故未加）
- ⏳ `vitest.config.ts` 的 `testTimeout` 5s → 20s（E2E 子进程在并行下超时）

## 最近决策

- 2026-09-16：落盘门禁用 `contentRules`；`standardRules = contentRules + 索引规则`
- 2026-09-16：E2E 超时预算 5s → 20s

## 关联

`tasks/collab-apply/spec.md` · `decisions.md` · `parking-lot.md` · `candidate-queue.md`
