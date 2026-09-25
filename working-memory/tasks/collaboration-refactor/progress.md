# Collaboration Refactor Progress

**更新**：2026-09-16

> 第八至十轮已冻结到 `_archive/2026-09-16-第八至十轮.md`。
> 那里是历史快照；**当前状态只以本文件为准**。

## 当前阶段

**MCP 接入完成（第十一轮）**。知识库既能被 CLI 驱动，也能被 AI 客户端通过 MCP
**结构化**读取 —— 不必再把整个知识库塞进上下文。

## 已完成（累计）

- ✅ 约定层收敛：**19 → 8**（ADR-0005 ~ 0008）
- ✅ 工具链闭合：`new` / `parse` / `apply` / `index` / `validate` / `catalog` / `fix` / `memory`
- ✅ 校验器 3 → 9 条规则（含 `CATALOG_STALE` / `UNDECLARED_DIR` / `ID_NOT_IN_ALIASES`）
- ✅ 基座冻结（`meta/base-contract.md`）+ 工作记忆新鲜度检查（`collab memory`）
- ✅ **MCP 服务器**：6 个只读工具，双协议时代

## 第十一轮：MCP 接入（2026-09-16）

`collab mcp` —— 把知识库以 **MCP stdio 服务器**暴露给 AI 客户端。
六个工具：`collab_catalog`（路由表）、`collab_read`（按 id/路径读单条）、
`collab_search`（搜 id/标题/正文）、`collab_validate`（结构化 Issue）、
`collab_parse`（A17 文本 → bundle，不落盘）、`collab_apply_plan`（预演计划，**永不写盘**）。

**三个设计决定**

1. **不引入官方 SDK** —— 只用到 5 个方法，仓库运行依赖保持 2 个（yaml/zod）。
2. **双协议时代** —— `2026-07-28` 起 MCP 无状态（版本随每个请求的 `_meta`），
   之前是 `initialize` 握手；两种都实现，否则会有一半客户端连不上。
3. **`commit` / `push` 没有对应工具** —— A7 的"AI 不 commit、不 push"
   不再是散文，而是**工具表里不存在这一项**（实测 `collab_push` → `-32602 unknown tool`）。

**关键复用（避免第二份真相源）**：工具**不调用 `cmd*` 函数**（它们会写 stdout、
`process.exit`，在 MCP 里会破坏协议流）；因此抽出 `application/buildBundle.ts`
（action 推断唯一）、`serializeCatalog`（落盘形状唯一）、`cli/lib/version.ts`（版本号唯一）。

**验收**

| 项 | 结果 |
| :--- | :--- |
| `npm run check` | **595 tests / 43 files 绿**，lint 0 error |
| MCP 专项测试 | **50 条**（协议 12 / 服务器 14 / 工具 24） |
| 真库握手（现代 `server/discover` + 旧 `initialize`） | 坏行 **0**；旧协议**不带** `resultType` |
| 真库 `collab_validate`（经 MCP） | **106 entries / 0 errors / 0 warnings** |
| Codex 注册 | `codex mcp get collab` → enabled，stdio |

## 进行中

- **知识库那一半重审尚未做**：子 agent 投递失败（两次都没送达，详见
  `tasks/cli-audit/findings.md` 文末），CLI 那一半由主 agent 自己完成。
  下一步第一件事就是自己做知识库那份。

## 下一步

| # | 增量 | 状态 |
| :--- | :--- | :--- |
| 1 | **知识库重审**（对照五份 AI 报告 + 8 条约定逐条判定） | 未开始（子 agent 投递失败） |
| 2 | 修审计发现：F2 幽灵暂存条目 / F3 dry-run 退出码 / 加 help 一致性测试 | 未开始 |
| 3 | `parse` 收尾：删 `extract-bundle.mjs` 等旧脚本（D6） | ✅ 已完成；**边界契约 2026-09-26 换过**（ADR-0012：自描述 frontmatter），见 `tasks/parse-adr0012/handoff.md` |
| 4 | 进真实项目压测 collaboration | 待用户指定 |
| 5 | 真 CI | 用户裁决：**放后面** |
| 6 | MCP 写工具（可选） | 挂起 —— 避免第二份 apply 流水线 |

## 最近决策

- MCP 工具集刻意是"读 + 计划"——写与提交不进 MCP（A7 的结构化执行）
- `collab apply` 落盘门禁用 `contentRules`（不含索引规则）
- 工具与工作产物归 `collab-cli/working-memory`，`collaboration` 保持文档纯洁（见 `decisions.md`）

## 关联

`tasks/collab-apply/spec.md` · `tasks/collab-parse/spec.md` · `decisions.md` · `parking-lot.md`
