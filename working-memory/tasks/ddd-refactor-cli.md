# src/cli / scripts 的 DDD 整理（2026-09-26）

> **判据**：每一段代码只该住在一层里 —— domain 放规则，application 放决策，
> infrastructure 放 I/O 与外部库，cli 放参数与输出，mcp 放协议。
> 这份记录按"搬了什么、为什么、什么没搬"组织，命令都能重跑。

## 搬之前：`src/cli` 的两类错位

| 症状 | 证据 |
| :--- | :--- |
| **`cli/lib/` 里住着 I/O 适配器** | `findCollabRoot`（向上找 `.git` + 探测布局）、`enforcedTargets`（跨仓读文件系统）—— 它们是 infrastructure 的活，却被 cli 拥有 |
| **业务判断写在命令里** | `memory.ts`（217 行）**一个项目层都没 import**；`retire.ts`（309 行）、`fix.ts`（139 行）不经 application；`new.ts` 里同时有配额策略、id 生成、git 身份、模板、路径、写盘、输出 |
| **同一份知识写两处** | 条目章节清单：`sectionsPresent`（规则）与 `templates`（模板）各写一份 → `collab new adr` 生成过"过不了 validate"的条目 |
| **`scripts/` 里"活的工具"与"跑过的迁移"混住** | 8 个脚本里 6 个是一次性迁移，其中 3 个还被 `package.json` 当工具广告（`script:add-author` 等） |

## 搬之后

| 变更 | 从 | 到 | 为什么 |
| :--- | :--- | :--- | :--- |
| 工作区发现 | `cli/lib/findCollabRoot` | `infrastructure/fs/findCollabRoot` | 向上走目录 + 读文件系统 = I/O |
| 跨仓存在性检查 | `cli/lib/enforcedTargets` | `infrastructure/fs/enforcedTargets` | 同上 |
| 新条目序列化 | `cli/lib/templates` | `infrastructure/formatting/entryTemplate` | 它做的是 YAML + 模板渲染（外部库） |
| git 身份 | `new.ts` 内联 `execFileSync` | `infrastructure/git/gitIdentity` | 端口：用例声明"我要作者"，怎么拿由适配器决定 |
| 约定配额规则 | `new.ts` 内的 `if` + 长文案 | `domain/entry/agreementQuota`（`agreementQuotaExceeded`） | 它是**关于知识库的规则**；提取后可被单测直接钉住 |
| `new` 的决策 | 命令里的 9 段流程 | `application/CreateEntryUseCase`（`planCreateEntry`） | 决策归 application；命令只剩"解析参数 → 要计划 → 落盘/打印" |
| 章节清单 | 规则与模板各一份 | `domain/.../sectionsPresent.requiredSectionsFor` 单一来源 | 两处各写一份必然漂移（已实测过一次） |
| 一次性迁移 | `scripts/*.mjs` | `scripts/one-off/` + 该目录 README | `scripts/` 下**只留活的**（构建前置 + 门禁）；迁移脚本的 `ENTRY_KIND_DIRS` 是当时手抄，今天可能已漂移 |
| 可选格式化 | `cli/lib/formatEntry`（prettier 动态 import） | **删除** | 逐 kind 实测：prettier 对六种骨架**输出完全一致**；而它是 devDependency → 装机版根本没有，等于"开发机与用户跑不同代码路径" |

## 没搬（**下一步，不是漏了**）

| 还留在命令里的决策 | 为什么先不动 |
| :--- | :--- |
| `retire.ts`（309 行：可达性判定 + 三态 + 写 frontmatter） | 与 `new` 同型，应抽 `RetireUseCase`；它同时依赖 `enforcedTargets` 端口，抽取面比 `new` 大 |
| `fix.ts`（frontmatter 文本编辑） | 文本编辑属 infrastructure 的"格式适配"；判据（`idIsAlias`）已经复用领域规则 ✓ |
| `memory.ts`（WM 新鲜度） | 它读的是**主体仓的 working-memory**，与 KB 无关 → 该抽 `MemoryUseCase` + 一个 WM 端口 |
| `scripts/one-off/` 是否合并成通用迁移工具 | `parking-lot.md` 有未决项："等第三次迁移需求" —— **不替人拍板** |

## 本次验证（命令都在）

| 项 | 结果 |
| :--- | :--- |
| 门禁 | `npm run check` = 0；`npm run test:ci` = **761 通过 · 0 跳过**（52 → 53 个文件） |
| 打包 | `npm pack` → **93 files**；`.test.js` 0 · `.map` 0 · **无"已删源"残留** |
| BOM 扫描 | 全仓 `.ts/.json/.mjs/.md` 带 BOM 者 **0**（本轮修掉 6 个自己埋的 + 1 个上轮遗留） |
| 最小可用性复跑 | kb 路径（init → 六种 kind → index → catalog → validate = **6 entries / 0 issues**）、AI 粘贴通道（parse → apply —— 真产物链到库里不存在的条目，4 个 `DEAD_LINK` 属**预期**）、MCP（6 工具 + 推导路径 + stdout 纯 JSON）、门禁（commit/push 先过 validate）全部符合预期 |
| KB 自举 | `collab validate` → **129 entries / 0 issues** |
