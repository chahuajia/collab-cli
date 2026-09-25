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

## 完成记录（2026-09-26，接手的那一轮）

**状态**：落地完成，改动全在工作区，**待人确认 / commit**。

| 项 | 结果 |
| :--- | :--- |
| 测试 | **746 / 746 · 52 files**（`npm test`，含 `pretest` 构建） |
| 类型 / lint | `tsc --noEmit` 干净；`eslint src` **0 error**（5 条 magic-number warning 是既有的） |
| 回归夹具 | `D:\下载缓存\test.txt` **原样** → `parse` 派生 `patterns/lenient-parsing.md` → `apply` 落盘 **2324 bytes**，无需人工裁剪 |
| 污染形态 | 开场白 + ` ```text ` 围栏 + 漏写 `END FILE` + 合规说明表 + 追问 → 落盘内容只含条目（表/追问/围栏都不进正文） |
| KB | `collab validate` → **129 entries / 0 issues** |

**与本文档的偏离（都是有意的，理由见 `decisions.md`）**：

1. `parseCollabText` **不在 `src/domain/parse/`**，而在 `src/infrastructure/parsing/parseCollabText.ts`
   —— 新契约要读 YAML 拿 `id`/`type`，domain 不许依赖外部包（ESLint 分层）。
   `ParseIssues` 仍留 `src/domain/parse/`（Issue 工厂，纯）。
2. 产出形状改为 `Ok({ files, warnings })` —— 否则"跳过并 warn"里的 warning 在成功路径上会被吃掉。
3. 新增 `PARSE_PATH_MISMATCH`（Warning）：`===== FILE:` 与 frontmatter 不一致时点名两者。
4. 顺带加了"围栏只当块尾，且仅当块首在围栏内"—— 这是"漏写 END + 整批套围栏"形态的必要条件。
5. 也顺手改了三处会变成"承诺与现实不符"的文案：`README.md`、`src/cli/index.ts` 的 help、
   以及 `cli/commands/parse.ts` / `mcp/handlers.ts` / `mcp/tools.ts` 的说明。

**已知边界**（没做，也说明了为什么）：既无标记、无围栏、又漏写了"下一个条目 frontmatter"定界的
**最后一个**条目，其正文会一路吃到原文末尾 —— 尾随散文与条目正文在那里**无法区分**，工具不猜。

## 收尾清扫（同一轮的追加动作）

改完点名的那批文案后扫了两个仓的 `===== FILE:` / `A17` 引用，分清"记录"（evolution-log、
ADR、归档 spec —— 不动）与"活文档"（会被当现行契约读的 —— 修）：

| 位置 | 问题 | 处理 |
| :--- | :--- | :--- |
| KB `patterns/lenient-parsing` | **直接和新契约矛盾**：它写着"块外非空白内容必须报错"（它是当天从旧实现提炼的） | 判据从"宽容/严格"改成**先问边界依据**：自描述 → 跳过 + warn；靠包装 → 报错。加了"方向修正"小节 |
| KB `integrations/_index.md` | 索引说明栏写"`===== FILE:` 协议" | 改成"自描述 frontmatter 定边界（标记只是提示）" |
| KB `skills/S10-collab-cli` | 落地顺序把 `parse` 记成 ⬜ 未做、描述为"A17 文本" | 改 ✅ + 现行描述；顺手把 `init` 从"未做"里拆出（它已落地） |
| `src/cli/commands/apply.ts` | 注释说"文本协议由**未来的** `collab parse` 负责" | 改成现状描述 |
| WM `tasks/collab-parse/spec.md` | 规格里的旧边界契约会误导下一个接手的人 | 顶部加作废指针（保留仍有效的 D1–D4 / D6 与"与 apply 的分工"） |
| WM `tasks/collaboration-refactor/progress.md` | "`parse` 收尾：… 未开始" | 更正为已完成 + 契约变更指针（**不动它的 `更新：` 日期** —— 见下） |

**没做的事（有意）**：`collab memory` 报 **6/7 个 WM 文件过期**（8–9 天），这是既有红灯，
不是本轮产生。**我不刷时间戳** —— 那会造出一个假绿灯（WM README 自己写着"这一行只能人写"）。
要灭这盏灯得由人决定"更新还是降级成归档"。

## 第二轮：发布前实测（同一轮的追加动作）

按"更新 `RELEASE.md` 到真实状态"的推荐动手，用**实测**而不是抄旧数字，结果实测反过来抓出三个 bug：

| 项 | 实测 |
| :--- | :--- |
| 测试 / 类型 / lint | **747 / 747 · 52 files**；`tsc` 干净；`eslint` 0 error（5 条既有 magic-number warning） |
| 打包 | `npm pack` → **98 files / 109 kB**（unpacked 329.6 kB）；`.test.js` 0 · `.map` 0 · `.d.ts` 0 · `bin/collab.js` 就位 |
| 装机 | 干净目录装 tgz → `--version` 通过；`init` 两个 profile 均实测 |
| 自举 | 真实 KB `validate` → **129 entries / 0 issues**；kb 空骨架 `validate --dir .` → 0 entries / 0 issues |

**抓出的三个 bug（已修）**：`scripts/collab-validate.mjs` 只在 `consumer + --kb` 下生成，
但 ① kb profile 生成的 `README.md` 把它列成"唯一的 CLI 调用点"并给成验收命令、
② `init` 收尾的"下一步 2"、③ kb 自检失败路径 —— 都在让人去跑那个不存在的文件。
②③ 改成按 `gateReady` / profile 分支，① 换成 `npx --yes @chahuajia/collab-cli@^0.5 validate --dir .`；
`init.test.ts` 加 I12b 并把 I13/I14 的断言收紧（**不许出现 `node scripts/collab-validate.mjs`**，
除非 wrapper 真的生成了）。顺带清掉 wrapper 兜底文案里"尚未发布到 npm"这句假话。

**第三轮又抓出一个 bug（已修）**：`init --profile kb` 的骨架**工具链根本不认** ——
实测 `validate` / `new` / `catalog` / `index` / `fix` **五条命令全部**报
`no COLLABORATION workspace found`，**连第一条条目都落不了**；而 `init` 自检报 0 issues
（它直接 `FileWorkspaceLoader(collabDir)`，绕过了工作区识别）。
根因：布局 B 的标记是**目录**，而**空目录进不了 git** → clone 之后骨架就"不是知识库"了。
修法：kb profile 把六个 kind 目录的 `_index.md`（空表，内容由 `renderIndex` 生成）写进**计划**
（进计划 `--dry-run` 才不会说谎）。验收测试 I1/I1b：`init → new → catalog → index → validate`
全程不带 `--dir`，`1 entries / 0 issues`。

**为此外加的一次分层修正**：`renderIndex` / `parseIndex` 原在 `src/cli/lib/`，而"生成索引内容"
是 application 层的活（它和 `extractIndexEntries` 是同一关切的两半）。若从 `InitUseCase`
import `cli/lib` 就是**反向依赖**，所以把它俩（含测试）移进 `src/application/`。

**同一轮又抓到第三个（会上市的那种）**：`tsc` 不清 `outDir`，而 `files` 收整个 `dist/` ——
**源文件一改名/移动，删掉的模块照样被打包发布**。证据：已发布的 `0.5.1`（97 files）里带着
`GitAdapter` / `ConsoleReporter` / `extractAllIdsByKind` / `falsifierRatchet` / `rules/index.js`
五个**早已无源**的模块。修法：`npm run build` 先跑 `scripts/clean-dist.mjs` 清空 `dist` →
本仓包从 98 files（含 7 处残留）降到 **91 files**（逐项核对：被移除的每个模块在 `src/` 里
既无源也无引用）。机制优先于散文 —— 不写"记得删 dist"。

## W4 复盘（2026-09-26 · 三问 + 行动项）

> 按 KB 入口症状表的规定动作走：**必须输出行动项，否则不算完成**（`workflows/W4-three-question-retro.md`）。

### Q1 哪个技能 / 模式最有效？

| 最有效 | 它具体做了什么 | 证据 |
| :--- | :--- | :--- |
| **交接文档的"已就绪零件"表** | 直接点名 `ParseIssues.skipped` / `Issue.isBlocking()` / `EntryKindDir` 的**位置**，省掉重造三个零件 | 本轮没有重写任何一个；`handoff.md` 那张表是本仓 `tasks/` 里第一次这么写 |
| [[patterns/parse-dont-validate]] | 拦住"按交接文档把 YAML 解析留在 `domain/parse`"这条路 —— 边界解析、领域只收类型化数据 | 最终落在 `infrastructure/parsing/`；见 `decisions.md` 2026-09-26 第一条 |
| [[patterns/reproducible-verification]] | 把"验收标准"从仓外文件搬进 CI（真产物夹具 + `-text` + 两条测试） | 749 测试绿；夹具 SHA-256 与原文件一致 |

### Q2 工作流哪一步卡住了？

1. **`brief` 里的文件路径是断言，不是判据。** 交接文档说"重写 `src/domain/parse/parseCollabText.ts`"，
   而新契约要读 YAML —— domain 不许 import 外部包。真正定音的是 `npm run lint` 的分层规则，
   **不是文档里那句话**。→ 行动项 A1（已登记候选队列）。
2. **验收标准的"证据"在仓外。** 交接文档把 `D:\下载缓存\test.txt` 定为回归夹具，
   但那不在任何仓里 —— 下一个人无法重跑验收。→ 行动项 A2（**已执行**）。

### Q3 约定是否需要补充？

**不需要。** 两个候选（"前提要能被验证" / "手写的数必然腐烂"）都已由既有 patterns 覆盖，
再加一条约定只会稀释 `agreements/`（该层有上限，且按 A6 约定变更须双方确认）。→ 不新增。

### 行动项（W4 的产物）

| # | 行动项 | 状态 |
| :--- | :--- | :--- |
| A1 | `brief` 里写"改哪个文件"要**同时给一条能证伪它的命令**（如 `npm run lint` / `npm test`）—— 只给路径等于把假设当判据 | 已登记 `working-memory/candidate-queue.md`（未达阈值，不新建条目） |
| A2 | **真产物入仓**：`__tests__/fixtures/real-ai-output.txt`（SHA-256 与原文件一致）+ `.gitattributes`（`-text`，隔离 git 换行策略）+ 单元与 CLI 端到端各一条测试 | **已执行**（749 测试绿） |
| A3 | KB `meta/interceptions.md` 记一行（[[patterns/reproducible-verification]] 拦住的那条） | **已执行** |

## 提交状态与剩余计划（**AI 不 commit、不 push**）

两仓自己的门禁已过：`npm run check` = 0，`npm run test:ci` = **750 通过 · 0 跳过**。

**已由人提交**（2026-09-26，两个提交就装下了整轮 parse 变更 —— 原本备了 6 个，人的收尾更紧）：

| 仓 | commit | 内容 |
| :--- | :--- | :--- |
| collab-cli | `fe10844 feat(parse)!: 条目边界改用自描述 frontmatter（ADR-0012）` | 契约 + 夹具 + `init` 文案修正 + RELEASE.md + WM（26 files） |
| collaboration | `a0b0d2f feat(chatgpt-output-format): 更新AI输出格式协议支持自描述frontmatter边界` | 协议节 + 索引 + S10 + 两本账（6 files） |

**待提交（第三轮：kb 骨架 + 构建卫生）** —— 三个关切，路径可直接喂 `git add -A`：

| # | message | 路径 |
| :--- | :--- | :--- |
| 1 | `fix(init): kb 骨架自带六个 kind 目录的空 _index.md（空目录进不了 git，骨架曾"工具链认不出"）` | `src/application/InitUseCase.ts` · `src/cli/commands/init.ts` · `src/cli/commands/__tests__/init.test.ts` |
| 2 | `refactor(application): renderIndex / parseIndex 移出 cli/lib（与 extractIndexEntries 同层，避免 InitUseCase 反向依赖）` | `src/application/renderIndex.ts` · `src/application/parseIndex.ts` · `src/application/__tests__/` · `src/cli/commands/index.ts` |
| 3 | `fix(build): 构建先清 dist（tsc 不清 outDir，已删模块会被打包发布；0.5.1 实测带 5 个无源模块）` | `scripts/clean-dist.mjs` · `package.json` · `RELEASE.md` |

`collaboration` 侧待提交：`meta/interceptions.md`（新增一条拦截行）。

已提交那个 parse 提交的 body 要点（若之后要写 release note，从这里取）：

```
- 契约：边界 = 条目自描述 frontmatter（--- … --- 含 id/type）；路径派生 EntryKindDir[type] + "/" + id + ".md"
- `===== FILE:` 降级为可选冗余：仍定界，但路径以 frontmatter 为准；不一致 → 新增 PARSE_PATH_MISMATCH(warn)
- 不合法块跳过 + WARN（ParseEmptyBlock / ParseDuplicatePath 由 Error 降为 Warning；重复保留最后一个）
- 判据 issues.some(isBlocking)；产出形状 Ok({files, warnings}) —— 成功路径也要能带 warning
- 实现移到 infrastructure/parsing（domain 不许 import YAML；patterns/parse-dont-validate）
- 验收证据入仓：真产物夹具 + .gitattributes(-text) + 单元/端到端各一条
BREAKING：输出形状与"拒收"判据都变了；且丢 slug（skills/S36.md，已存在的 slug 文件不会被判成 replace）
```

### collaboration（2 个提交）

| # | message | 路径 |
| :--- | :--- | :--- |
| 1 | `docs(integrations): 条目边界协议改用自描述 frontmatter（ADR-0012）` | `integrations/_index.md` · `integrations/chatgpt-output-format.md` · `skills/S10-collab-cli.md` |
| 2 | `feat(patterns): lenient-parsing 判据参数化（先问边界依据）+ 两本账` | `patterns/lenient-parsing.md` · `meta/evolution-log.md` · `meta/interceptions.md` |

### 之后（人执行，AI 不碰）

```bash
npm version 0.5.2 && npm publish --access public   # 见 RELEASE.md 一、二节
```
