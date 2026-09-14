**未来文件路径**：`working-memory/parking-lot.md`

```markdown
# Parking Lot

> 讨论中冒出但暂不处理的话题。**不打断当前对话，也不遗忘。**

## 未决项

- [ ] `split-collab.mjs` 内容划分问题 —— 待用户明确具体错误（2026-09-13）
- [ ] v4.1 bundle 拆分到 `COLLABORATION/` —— 依赖 split 脚本修复（2026-09-13）
- [ ] `<待填>` author 字段批量填充 —— 待定何时执行（2026-09-13）
- [ ] MCP Server 实现 —— 等 `collab-cli` 完成 validate/new/index/commit 四个核心命令（2026-09-13）
- [ ] W12 会话切片工作流 —— 等实践 3-5 轮会话切片后再定稿（2026-09-13）
- [ ] `collab index` 命令 —— Spike 未启动（2026-09-13）
- [ ] `collab validate` 命令层 —— 领域逻辑已就绪，CLI 层未接（2026-09-13）

## 已处理

（空）

# Parking Lot

## 未决策项

- [ ] **`collab edit` / `collab deprecate` 等新命令** —— 等验证 5 命令足够后（2026-09-14）
- [ ] **`--dir` 参数** —— YAGNI，等真实需求（2026-09-14）
- [ ] **`scripts/add-author.mjs` 和 `scripts/add-dates.mjs` 是否合并成"通用迁移工具"** —— 等第三次迁移需求（2026-09-14）

## 未触发项

- [ ] **`split-collab.mjs` 内容划分修复** —— 等用户明确具体错误（2026-09-14）
- [ ] **v4.1 bundle 拆分** —— 依赖 split 脚本修复（2026-09-14）
- [ ] **MCP Server 实现** —— 等 collab-cli 完成五命令 + 有真实 MCP 客户端场景（2026-09-14）

## 已处理

- ✅ `add-author.mjs` 的目录范围 bug（2026-09-14）
- ✅ `collab index` 用文件名当 id 的 bug（2026-09-14）
- ✅ ADR status 校验（2026-09-14）
- ✅ `created` / `updated` 字段迁移（2026-09-14）


split-collab.mjs bug → 等"用户的具体错误描述" → 保持挂起 ✅

v4.1 bundle → 等"split 脚本修好" → 保持挂起 ✅

MCP Server → 等"CLI 完成 + 真实 MCP 场景" → 保持挂起 ✅

待沉淀清单 1-8 → 等的是"分析" → 立刻处理 ✅（本轮做）

"挂起"不是"拖延" —— 是"等对的东西"。