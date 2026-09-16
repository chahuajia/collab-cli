# Collaboration Refactor Progress

**更新**：2026-09-16

## 当前阶段

**校验归零 + 工作空间归属确立**：`collaboration` 只放文档，工具与工作产物归 `collab-cli/working-memory`。

## 已完成

- ✅ **落盘 v4.1**：58 条（A11-A16 / W8-W10 / S12-S35 / 25 模式 / ADR-0003-0004）
- ✅ **字段迁移**：107 个文件补 `author` / `created` / `updated` / `aliases`（`normalize-frontmatter.mjs`）
- ✅ **A17-A19 落盘**（用户完成）+ 修复其 frontmatter 畸形（`applies-to:` 被 `allsupersedes:` 吃掉 → null）
- ✅ **索引同步**：`agreements/_index.md` 补 A17-A19
- ✅ **坏链修复**：S31 / S32 / A19 里的 `[[A18-内外有别：统一语言的方位词]]` → `[[A18-内外有别]]`；粘连链接补空格
- ✅ **`collab validate`：108 entries / 0 issues**（改前 35 entries / 206 issues）
  - ⚠️ **2026-09-16 实测纠正**：该断言此前**是过期/错误的** —— 实跑为 **2 errors**
    （`A17` 未登记；`_index.md` 里 `[[A17-对话式AI 输出格式约定]]` 多了一个空格）。
    已修（`agreements/_index.md`），现为真 0。
    教训：结论要附**可复现命令**，否则 working-memory 自己会腐烂。
- ✅ `AGENTS.md` 薄入口 + `inbox/` 策略 + 模板集中化 + pruning-policy 升级 + `meta/interceptions.md`
- ✅ **`collaboration/scripts/` → `collab-cli/scripts/`（用户完成）**：6 个脚本已迁移，`collaboration/` 下已无 `scripts/` 目录

## 进行中

（空）

## 下一步（按依赖链）

| # | 增量 | 为什么在这个位置 | 状态 |
| :--- | :--- | :--- | :--- |
| 1 | **`collab apply`** | 唯一阻断"AI 产出 → 入库"的缺口；也是本工作流自己的高频需求 | ✅ 已完成（`tasks/collab-apply/progress.md`） |
| 2 | **`collab parse`**（A17 文本 → bundle.json） | 让对话式 AI 的输出可直接落盘；`apply` 的另一半 | 📋 规格待拍板（`tasks/collab-parse/spec.md`）← **下一步** |
| 3 | **`collab catalog`**（路由表 + 适应度信号：引用数/拦截数/体积） | 上下文 O(n) → O(log n)，同时装上"收益可测" | 未开始 |
| 4 | **配额**（`new` 在 active 超阈值时拒绝） | 让"加"包含"减"，唯一的环境型代谢机制 | 未开始 |
| 5 | **浏览器插件**（可选壳） | 先证明 `parse` 不够用再做，否则会绑定站点、吃掉跨工具中立 | 待 `parse` 结论 |

## 遗留（需要用户或后续处理）

- ⚠️ **迁移后的脚本假设 `cwd` 是 collaboration 仓库**：
  `extract-bundle.mjs` 与 `normalize-frontmatter.mjs` 都用 `process.cwd()` 定位工作区。
  从 collab-cli 直接跑会找错目录。两种修法（择一，属 `collab parse` 的范围）：
  1. 加 `--dir`（复用现有 `findCollabRoot` 的三层定位）；
  2. 在 `scripts/README.md` 写明"必须在 collaboration 目录下执行"。
- ✅ **`collaboration/.landing/`** —— 2026-09-16 实测：**已不存在**，无需处理
- ✅ **`test-cil` / `single-entry` 分支** —— 2026-09-16 实测：**不存在**；
  collaboration 只剩 `main`，collab-cli 是 `collab-new` / `main` / `validate`。该项作废
- ✅ **A17/A18/A19 的 H1** —— 2026-09-16 实测：**三条都有 `# 标题` 了**，该项作废
- ✅ **`AD` 残留** —— 2026-09-16 已 `git rm --cached` 清掉
  （`agreements/A10-review-上移原则.md`、`meta/evolution-log-format-old.md`）

## 2026-09-16 实测新增（用完工具才看得见的问题）

**`collab index` 会摧毁人工索引**（已在真库副本上复现、已修）：

- 实测：对真库跑 `collab index` → agreements `removed 19 / added 19`、skills `removed 35 / added 35`，
  人工列（名称/领域/状态）**全部丢失**。
- 根因：**引用匹配规则有两份**。`domain/validation/resolvesRef.ts` 认"短 id / 路径 / 文件名"，
  而 `cli/lib/renderIndex.ts` 自己写的 `normalizeRef` 只认短 id —— 于是合法的
  `[[S1-h2-output]]` 被判成悬空行删掉。
- 修法：规则收敛为 `refersToIdentity()` 一份，`renderIndex` 复用它；
  `extractAllIdsByKind` → `extractAllIndexEntries`（带 fileName）。
- 验证：真库副本重跑 → **agreements/skills/workflows 全部 `removed 0`**，人工列完好；
  patterns 是 `added 29`（真库 patterns 索引本就没列全，属正常补齐）。
- 回归测试：`renderIndex.test.ts` 2 条 + `index.test.ts` T5 1 条。

## 2026-09-16 第二轮：五份外部评估 → 去幻修复

读了 `E:\file\notes\前端\ai\` 下五份评估（codex / ds / claude / deepseek-harness / 批判）。
它们**独立收敛到同一诊断**：`evolution-log` 107 次新增、**0 次删除/合并**；成本被实时惩罚、收益无人测量 → 只朝"便宜"漂。

### 核查结论：指控分三类（不照单执行）

| 类别 | 内容 |
| :--- | :--- |
| ✅ 已修（不用动） | 死链 0、AGENTS.md 已建、bundle 已移出、`.gitignore` 已补、S5/S6 已修、A9/A10 已改名、A17 的 `id` 与文件名空格 |
| ❌ 指控过期 | `templates/agreement-template.md` 围栏未闭合（实为 0 个围栏）；`evolution-log` 日期 `026-09-11`（实为正确） |
| 🔴 仍是活的问题 | 见下 |

### 本轮实修（"承诺 vs 现实"类）

- ✅ `S10-collab-cli`：把不存在的 `init` / `propose` / `pr` / `sync` 从"使用说明"降为**设计草案**；
  写明 `apply` 的**语义变更**（草案：确认 patch 生成 commit → 现实：落盘 bundle）
- ✅ `profiles/_index` / `pruning-policy` / `S11`：`collab sync` 三处承诺全部标注**尚未实现**
- ✅ `evolution.yml`：**删除**（五项校验一项未做、从未运行过的假绿灯）
- ✅ `.idea/` 退出跟踪；`S5` 去掉误连的 `[[S4]]`；`templates/agreement-template.md` 关联补空格
- ✅ `meta/interceptions.md`：把唯一一行标为**样例**，并显式写出"真实记录当前 0 条"
- ✅ `AGENTS.md`：补"工作记忆不在本仓库"（A13 说阅读顺序 `working-memory → COLLABORATION`，但本仓库没这个目录）

验证：`collab validate` → **108 entries / 0 issues**；`AGENTS.md` 44 行（A13 要求 ≤100）。

### 未动（需拍板，见 `parking-lot.md`）

拆协议/手册、A10+W8+S27+review-marginal-value 四合一、A18/A19/A14 降层、
0 人社群治理归档、`domains/` 空壳、语义 id、`assumes` 字段、`dual-expression` 缺家、项目 vs 文章顺序。

## 2026-09-16 第三轮：第一次"选择"事件 ✅

**用户拍板 + 裁决顺序：先合并那 4 条，再拆协议/手册。**

### 做了什么

`A10` / `W8` / `S27` / `patterns/review-marginal-value` **四条 320 行 → 一条约 130 行**。

- 保留 `agreements/A10-review-前置原则.md`（id `A10` 不变，20 处引用不动）
- 删除 `W8-规格优先的-AI-协作流程` / `S27-规格优先-review` / `review-marginal-value`
- 旧编号进 `aliases`；**14 个文件**的引用改指 A10（脚本 + 人工两段）
- 清掉合并产生的重复引用 3 处；删除编造的"3-5 倍""等价于读 1000 行代码"
- 新增 `ADR-0005-合并四条-review-规则`（A10 规定约定级变更必须写 ADR）
- `evolution-log` v4.2.0（**第一条"确认者已确认"+"含删除"的记录**）

### 验收

| 项 | 结果 |
| :--- | :--- |
| `collab validate` | **106 entries / 0 issues**（合并前 108 / 0；净 -3 条目 +1 ADR） |
| 残留旧引用 | 只剩 A10 自己的 `aliases` 与合并说明（有意保留） |
| 全库条目数 | 118 → 115（含非条目文件） |

### 顺带确认的事实

`aliases` **不被 validator 使用** —— `resolvesRef` 只看 id 与文件名。
所以旧编号不能靠 `aliases` 自动解析，引用必须真改。已记入 `candidate-queue`。

### 下一步

**拆"协议层 / 手册层"**（用户已排序为第 2）：`agreements/` 收到 ≤10 条，其余降级为手册。
操作规程已跑通并记入 `parking-lot.md`，下次照做。

## 2026-09-16 第四轮：链接规则修正 + 作者默认值

### #3 链接必须按文件名解析（用户报告的验收缺口）

**根因**：`meta/naming-conventions.md` 明文教"条目互链用双括号包裹 **ID**，如 `[[A1]]`"，
而**验收从未检查过**。渲染层只认文件名 —— 于是 id 形式的链接"工具说合法、人点不开"。

- 工具：`resolvesRef` 去掉 id 匹配；`refersTo` 只认文件名；`renderIndex` 新行渲染**文件名**
- 新增规则 `ID_FILE_NAME_MISMATCH`：id 必须是文件名前缀（`-` 为界）
- 死链建议语改为提示"用文件名链接"
- 规范：`meta/naming-conventions.md` 的链接一章重写（这是根因文档）
- 数据：全库仅 **1 处**违规（`W9` 里的 `[[A10]]`，是上一轮合并脚本留下的）→ 已修
- **推翻旧决策**：`index.test.ts` 的 T1–T4 原断言"索引用 id 不用文件名"，已按新规则翻转

验证：知识库 `106 entries / 0 issues`；`collab index` 在真库副本上 **removed 0**；全仓 **477 tests 绿**。

### #4 作者默认值

`collab new` 改为读 `git config user.name`（兜底 `user.email`）；6 个模板占位符改 `<git user.name>`。

### 本轮发现（待处理）

- 🔴 **`A1-output-format` 与 `skills/S1-h2-output` 是重复条目** —— 讲的是同一件事。
  所以"A1 搬到 skills"应该是**合并进 S1**，不是搬家。
- ⚠️ `ADR-0003` / `ADR-0004` 的 `author: <待填>` 仍未填（不能替你猜作者）。

## 2026-09-16 第五轮：约定层收窄（第二批）

**用户拍板**：`A9` 降级；**`agreements` 的定义 = 协作规则**。

### 排查方法（19 条逐条过）

四条判据：**是协作规则吗？能自查吗？前提准确吗？与已有条目重复吗？**

### 已执行（19 → 15）

| 条目 | 处置 | 证据 |
| :--- | :--- | :--- |
| `A2-depth-and-reflection` | 并入 `W2-three-stage-analysis` | 三段式逐字重复 |
| `A8-设计不是可选项…` | 并入 `patterns/design-decision` | 逐字重复（该 pattern 自己写着"源自 A8"）|
| `A9-跨域借鉴…` | 并入 `patterns/cross-domain-borrowing` | 逐字重复（该 pattern 写着 `source: A9`）|
| `A5-declare-mode` | **删除** | 可表演、零约束力（五份评估一致点名）|

- 新增 `ADR-0006-约定层收窄为协作规则`；`agreements/_index.md` 写明本层定义 + "内容该放哪"的路由表
- 改动落在 15 个文件的引用 + 3 个目标条目（吸收独有内容）+ ADR + 日志
- 验收：`collab validate` **103 entries / 0 issues**

### 待办

剩余 15 条的处置见 `parking-lot.md`。全部执行后 `agreements/` = **8 条**。
其中**用户点名过、证据最硬的 4 条**优先：`A16` 前提错、`A4` 触发太宽、`A13`/`A15`/`A17` 假设对话式 AI、`A7` 不可执行。

## 2026-09-16 第六轮：集成层落地 + 工具加类

**用户拍板**：其余需拍板的都执行拆解/降级；并确认"无文件权限的对话式 AI 是真实场景"。

### 工具侧（collab-cli）

新增 `EntryKind.Integration`：`integrations/` 成为**可校验、可索引**的一等目录
（改了 `types.ts` 的 5 张 Record 映射 + `sectionsPresent` + `renderIndex` + `templates` + `new` 的合法类型）。
全量门禁：**477 tests / 32 files 绿**，lint 0 error。

### 知识库侧

- `A15` → `integrations/chatgpt-paste-protocol`
- `A17` → `integrations/chatgpt-output-format`
- `A7` → **拆**：`integrations/cli-agent-boundaries`（改写为**可执行版**：AI 有权限但不 commit / 不 push）+ 社区治理归档
- `A16` → **前提修正**（FIFO/机械截断 → 不可控压缩函数；删"每 10 轮复述"）
- 新增 `ADR-0007-建立集成层`；17 个文件的引用改指新名

验证：`collab validate` **104 entries / 0 issues**；约定 15 → **12**。

### 待办

`parking-lot.md` 里剩 7 项：`A3` `A4` `A13` `A14` 改写、`A1` 并入 S1、`A18`→meta、`A19`→workflows、`A11` 降级。

## 2026-09-16 第七轮：约定层收敛完成（19 → 8）✅

### 已执行

| 条目 | 处置 |
| :--- | :--- |
| `A1-output-format` | 并入 `skills/S1-h2-output` |
| `A11-值同不代表语义同` | 降级为 `patterns/value-semantics` |
| `A18-内外有别` | 迁入 `meta/terminology` |
| `A19-递归式分析原则` | 迁入 `workflows/W11-递归式分析` + **删配额棘轮** |
| `A3` | 删"鼓励"（不可自证），留"主动侦查 + 显式返回" |
| `A4` | 触发收窄为三条**可观测事件**；删"回答开头声明触发"；新增"本次不沉淀是合法产出" |
| `A13` | 拆分：外部知识库"怎么读" → 指向 `integrations/` |
| `A14` | 删"实体 vs 演化体"哲学段 |

- 新增 `ADR-0008-约定层收敛完成`；11 个文件引用改指新家；索引补 2 行、清 4 行
- validate 抓出 3 个我犯的错（`S1` 的 YAML 重复键、两条缺索引行）+ 1 个 ADR 缺章节 —— 全修

### 验收

| 项 | 结果 |
| :--- | :--- |
| `collab validate` | **103 entries / 0 issues** |
| `npm run check`（collab-cli） | **477 tests / 32 files 绿**，lint 0 error |
| 约定数 | 19 → **8**：`A3 A4 A6 A10 A12 A13 A14 A16` |
| 全库残留旧编号引用 | 0（除历史日志与 ADR） |

### 下一步

见 `parking-lot.md` 的"五篇文章里还没做的部分"（代谢律变脚本、catalog、冻结基座、真 CI…）。

## 2026-09-16 第八轮：工具开始写机械字段

**用户拍板**：工具应当自动写 `id`/`aliases`/`author`/`type` 这类**机械事实**，尊重手动录入作为辅助。

### 已实现

1. **`collab new` 自动写入 `aliases: [id]`** —— 补一个真实漏洞：
   在此之前，**工具生产的文件违反工具自己的新规则**（`ID_NOT_IN_ALIASES`）。
   这与 `renderIndex` 那个 bug 同类：**工具与规则互相打架**。
2. **`collab fix [--dry-run]`** —— 只补不删：
   - 缺 `aliases` → 补；块状/行内两种写法都处理
   - 已有别名 → **追加**，绝不删改
   - 找不到 frontmatter → **报错**（不猜），exit 1
   - 判据复用 `idIsAlias` 规则（单一真相源）
3. **`patterns/reproducible-verification`** —— 回答"工程化那条要不要进库"：
   要，但按定义归 `patterns/`（它是**工程判据**，不是协作规则）。

### 验收

| 项 | 结果 |
| :--- | :--- |
| `npm run check` | **492 tests / 34 files 绿** |
| 知识库 `validate` | **105 entries / 0 issues** |
| 知识库 `fix --dry-run` | **0 处需要补**（真库本来就干净） |

## 2026-09-16 第九轮：catalog 进 validate + 派生物自刷新

- **`CATALOG_STALE` 进 validate**（用户拍板）：对比 `entries`、忽略 `generatedAt`；
  文件不存在则不报。**上线第一次运行就抓到 catalog 已过期**（我新增 pattern 后忘了重新生成）。
- **catalog 检查放在 application 层** —— 它组合 `buildCatalog`；ESLint 的分层规则当场抓出我放错层。
- **`apply` 落盘后自动刷新 `catalog.json`**：谁让派生物过期，谁负责刷新它。
  否则 `apply --commit` 必然卡在 `CATALOG_STALE`。
- 测试写错过一次：不带 `--index` 的 `apply` 之后 validate **理应**为红（新条目不在 `_index.md`）——
  这是设计，不是 bug。断言已改。

验收：**502 tests / 35 files 绿**；知识库 **105 entries / 0 issues**。

## 2026-09-16 第十轮：把"机制"补成闭环

### 新增机制（都是"工具会拦人"的那一类）

| 规则 / 工具 | 拦什么 |
| :--- | :--- |
| `ID_NOT_IN_ALIASES` | id 没登记进 aliases → 渲染层解析不了 id 链接 |
| `CATALOG_STALE` | `catalog.json` 与工作区不一致（生成物过期） |
| `UNDECLARED_DIR` | 未声明的顶层目录里出现文件（= 悄悄改基座） |
| `collab fix` | 补齐机械字段（**只补不删**，补不了就报错） |
| `collab new --dry-run` | 让"验证"不必真的写文件 |
| 约定层配额 | `new agreement` 在 active ≥10 时**拒绝**（无 `--force`） |
| `dormant`/`deprecated` | **退出路由索引**（不再进 catalog） |
| `extractLinks` | 跳过围栏与行内代码（不再误报"讨论链接"的文档） |
| `trigger`/`anti-trigger` | catalog 从"目录"变成"路由表"（先给 8 条常驻条目补） |

### 收尾

- `meta/base-contract.md`：**冻结基座** + 破坏性变更三件套（ADR + 迁移脚本 + validate 归零）
- `AGENTS.md`：阅读顺序**第一项改成 `catalog.json`**（此前造了路由表却没指向它）
- BOM 排查：139 个文件 **0 个带 BOM**，文章 #7 的隐患不存在

### 最终状态

| 项 | 结果 |
| :--- | :--- |
| `collab validate` | **105 entries / 0 issues** |
| `npm run check` | **517 tests / 36 files 绿**，lint 0 error |
| 约定 | **8 条**（19 → 8）；ADR 0001–0009 |
| 工具 | `new`(dry-run) `index` `validate` `commit` `push` `apply` `catalog` `fix` |

## 生态验证的三个项目（待确认）

| 项目 | 回答什么问题 | 性质 | 现状 |
| :--- | :--- | :--- | :--- |
| collab-cli | 循环能不能闭合 | 基础设施验证（器官） | 5 命令可用，378 测试（375 绿），`apply` 空壳 |
| 剪贴板 → `parse`（插件可选） | 输入能不能自动化 | 通道验证（器官） | 未开始；建议先剪贴板 |
| **一个真实前端项目** | 这套规范有没有让项目变好 | **价值验证（环境）** | **未指名 —— 建议尽快指定** |

> 前两个是系统自己的器官，只能验证"跑得起来"；第三个才是外部选择压力，产出 `interceptions.md` 的真实记录。

## 最近决策

- 2026-09-16：`collab apply` 落地；落盘门禁用 `contentRules`（不含索引规则）
- 2026-09-16：`collaboration` 保持文档纯洁，工具与工作产物归 `collab-cli/working-memory`（见 `decisions.md`）
- 2026-09-16：先修校验（206 → 0）再谈新功能

## 关联

`tasks/collab-apply/spec.md` · `decisions.md` · `parking-lot.md`
