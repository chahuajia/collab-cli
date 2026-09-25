# HANDOFF —— parse 契约变更（ADR-0012）

**写于**：2026-09-26 ｜ **读者**：新开对话的 agent（不是给用户的作业）
**取代**：上一轮对话的上下文 —— **新会话对那次对话一无所知**，本文件是唯一交接

## 30 秒定位

| 仓 | 路径 | 角色 |
| :--- | :--- | :--- |
| **collab-cli** | `D:\actto\front\project\collab-cli\collab-cli` | 工具链（真相仓） |
| **collaboration** | `D:\actto\front\project\collaboration_aggregate\collaboration` | 长期知识库 |

**当前状态**：两仓工作区干净；`collab validate` → **129 entries / 0 issues**；
collab-cli **734 测试全绿**；`init` 两个 profile 已实测；**0.5.2 未发布**
（发布清单见 `RELEASE.md`）。

**边界**：AI 不 push；改动留在工作区，由用户确认后提交。

## 任务：按 ADR-0012 落地 parse 的契约变更

**为什么**：对话式 AI 的真实输出是「开场白 + ```text 围栏 + 真条目 + 合规说明表 + 追问」。
旧契约（`===== FILE:` 人为分隔符）因此**整单拒收**（实测 15 条 `content outside any block`）。
ADR-0012 把边界改成**自描述 frontmatter**：块外散文天然被跳过。

## 步骤

1. 读 KB 的 `meta/decision-records/ADR-0012-条目边界改用自描述-frontmatter.md`
   —— 含**四条实现约定**（severity 判据 / 边界优先级 / 路径派生 / 重复处理）
2. 读 `src/domain/parse/parseCollabText.ts` 与 `src/domain/parse/__tests__/parseCollabText.test.ts`
3. 重写实现：边界改为 YAML frontmatter 块；路径派生 `EntryKindDir[type] + "/" + id + ".md"`；
   不合法块**跳过并 warn**；判据从 `issues.length > 0` 改为 **`issues.some(i => i.isBlocking())`**
4. **同步改断言**（旧断言写的是旧契约：块外内容报错 / 重复报错 / `===== FILE:` 是权威边界），
   并新增三种污染的真实用例：**围栏包裹 / 开场白 / 合规说明表**
5. 回归夹具：`D:\下载缓存\test.txt` **原样** —— 通过标准 = **不需要人工裁剪就能落盘**
6. 跑 734 全量；全绿后再改三处文案（`cli/commands/parse.ts`、`mcp/handlers.ts`、`mcp/tools.ts`）
   + KB 的 `integrations/chatgpt-output-format.md` + `meta/evolution-log.md` 一行

## 已就绪的零件（**别重造**）

| 零件 | 位置 |
| :--- | :--- |
| **Warning 通道** | `IssueCodeValues.ParseSkippedBlock` + `ParseIssues.skipped(reason, snippet)`（提交 `a9b04a8`） |
| **硬失败判据** | `Issue.isBlocking()`（= severity 是 Error） |
| **路径派生原料** | `EntryKindDir` / `EntryKindValues` 在 `@/domain/entry/types` |
| **契约规格** | ADR-0012 的四条实现约定 |

## 关联

ADR-0012 · `RELEASE.md` · `working-memory/README.md` · KB `patterns/lenient-parsing`