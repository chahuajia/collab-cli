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
