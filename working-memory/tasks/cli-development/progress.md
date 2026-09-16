# CLI Development Progress

**更新**：2026-09-14

## 当前阶段

**批次 2 完成** —— 四个跨层重构全部通过。

## 已完成

- ✅ 五命令实现（new / index / validate / commit / push）
- ✅ 全部 E2E 测试通过
- ✅ 自举：在 collaboration_aggregate/collaboration 上跑通 validate
- ✅ 数据迁移：author（51 files）、created/updated（17 files）
- ✅ 工具修复：ADR status 按 kind、`collectAllEntryIds` 用 frontmatter.id
- ✅ lint 修复（4 errors → 0）
- ✅ **批次 2**：
  - 任务 #1：`validateExplicitId` → `EntryId.create`
  - 任务 #2：`gitRun` → `infrastructure/git/`
  - 任务 #3：`generateNextId` → `application/`（拆 IO + 纯逻辑）
  - 任务 #4：`collectAllEntryIds` → `extractAllIdsByKind`（合并重构）
- ✅ 测试基础设施：`useTestWorkspace`（高阶工厂）、`writeEntry` 具名工厂族、`ExitCode` 常量、`toSucceed/toFail` matcher

## 进行中

（空）

## 2026-09-16 追加：`collab index` 修复（实测驱动）

用 `collab index` 跑真库副本时发现它会**摧毁人工索引**（agreements 19 行、skills 35 行被替换成空行）。

- 根因：引用匹配规则有两份 —— `renderIndex` 自己写的 `normalizeRef` 只认短 id，
  不认真库在用的 `[[S1-h2-output]]` 文件名式引用。
- 修复：规则收敛为 `refersToIdentity`（`domain/validation/resolvesRef.ts`）一份；
  `renderIndex` 复用它；`extractAllIdsByKind` → `extractAllIndexEntries`（带 `fileName`）。
- 验证：真库副本重跑 → agreements / skills / workflows 均 `removed 0`，人工列完好。
- 测试：`renderIndex.test.ts` +2、`index.test.ts` T5 +1、`extractAllIndexEntries.test.ts` 15 条。
- 全量：`npm run check` → 477 tests 绿，lint 0 error。

## 下一步（待定）

**候选方向**（未选）：
- **A. 批次 1 恢复**：测试重构（挂起中，可恢复）
- **B. 新功能**：`collab edit` / `collab deprecate` 等
- **C. 基础设施**：scripts TS 化 + 分层
- **D. 沉淀**：处理候选队列（已超 5 项，触发条件）
- **E. 别**：用户提议

## 挂起

- **批次 1（测试重构）** —— 用户决定挂起（2026-09-14）

## 锚点

1. 遵守 A10（Spike → 规格 → 测试 → 实现 → Review）
2. 每个复杂交互附知识笔记（A12）
3. 上下文按需读取，不全量（A16）
4. **What 不可封装 / How 可封装**
5. **纯函数进内层，带 IO 的进外层**
