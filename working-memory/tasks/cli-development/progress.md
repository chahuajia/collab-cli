# CLI Development Progress

**更新**：2026-09-14

## 当前阶段

**批次 1：测试重构**（进行中）——按 What/How 原则重写测试辅助。

## 已完成

- ✅ 五命令实现（new / index / validate / commit / push）
- ✅ 全部 E2E 测试通过
- ✅ 自举：在 collaboration_aggregate/collaboration 上跑通 validate
- ✅ 数据迁移：author（51 files）、created/updated（17 files）
- ✅ 工具修复：ADR status 按 kind、`collectAllEntryIds` 用 frontmatter.id
- ✅ 测试工具的 proto 版本：`runCliSuccess` / `runCliFailure` / `CLI_ENTRY`
- ✅ 深入讨论：What/How 原则在测试、业务、架构的统一

## 进行中

- 🔄 **批次 1：测试重构**
    - [ ] 1.1 加 `ExitCode` 常量 + 自定义 matcher（`toSucceed` / `toFail`）
    - [ ] 1.2 加 `useTestWorkspace` 到 `testHelpers.ts`
    - [ ] 1.3 加 `writeSkill` / `writeAdr` 等具名工厂
    - [ ] 1.4 4 个测试文件改用新 helper
    - [ ] 1.5 删除冗余断言（`expect(exitCode).toBe(0)`）

## 下一步（批次 2：代码重构）

- [ ] 2.1 `validateExplicitId` → 用 `EntryId.create`
- [ ] 2.2 `generateNextId` → 移到 `application/`
- [ ] 2.3 `collectAllEntryIds` → 移到 `application/`
- [ ] 2.4 `gitRun` → 抽到 `infrastructure/git/`
- [ ] 2.5 审视 `push.ts` 的 What/How 分离

## 遗留

- **v4.1 bundle 未落地**（39 条）——等 split-collab.mjs 修复
- **`split-collab.mjs` 的内容划分 bug**——挂起
- **`--dir` 参数**（validate / push）——YAGNI，暂不做
- **collab push 后是否 commit 未推送**——当前先做"最小化"，不加自动 commit

## 锚点

关键约束（**每次新对话必读**）：
1. 遵守 A10（Spike → 规格 → 测试 → 实现 → Review）
2. 每个复杂交互附知识笔记（A12）
3. 上下文按需读取，不全量（A16）
4. 当前阶段：批次 1（测试重构）
5. **What 不可封装 / How 可封装** —— 本次核心设计原则

## 待做任务（非条目）

- [ ] **`gitRun` 抽到 `infrastructure/git/`** —— 消除 `commit.ts` 和 `push.ts` 的重复
- [ ] **`validateExplicitId` 合并到 `EntryId.create`** —— 消除 DRY 违反
- [ ] **`generateNextId` 移到 `application/`** —— 层归属纠正
- [ ] **`collectAllEntryIds` 移到 `application/`** —— 层归属纠正
- [ ] push.test.ts中runCli重复函数删除并替换成有语义的公共函数
- [ ]讲解下为什么有时候idea的shift加F6不能自定义要替换的值，只能跟面板选择
- [ ]为什么，我有时候运行测试，不用重新build,也是可以的。运行测试之前必须重新打包？还是说需要配置的原因，我这里配置没做好？正确应该怎么做。