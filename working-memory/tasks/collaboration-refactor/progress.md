# Collaboration Refactor Progress

**更新**：2026-09-16

> 更早的轮次（第一至七轮）已冻结到 `_archive/2026-09-16-第一至七轮.md`。
> 那里是历史快照；**当前状态只以本文件为准**。

## 当前阶段

**约定层收敛完成（19 → 8）+ 工具机制补齐**。校验器从 3 条规则长到 9 条；
`apply` / `parse` / `catalog` / `fix` 落地，"AI 产出 → 入库"的通道闭合。

## 已完成（本文件覆盖的轮次）

- ✅ 第八轮：工具开始写机械字段（`collab new` 自动写 `aliases`、`collab fix` 只补不删）
- ✅ 第九轮：`CATALOG_STALE` 进 validate + `apply` 自刷 catalog
- ✅ 第十轮：`UNDECLARED_DIR` + 入口文件链接检查 + `trigger`/`anti-trigger`
- ✅ `collab parse` 落地（6 个决策按推荐执行，关闭 MVP 的进料口）

## 进行中

（空）

## 下一步

| # | 增量 | 状态 |
| :--- | :--- | :--- |
| 1 | **重审 CLI 与 collaboration**（对照五份 AI 报告 + 实操） | 未开始 |
| 2 | `parse` 收尾：删 `extract-bundle.mjs` 等旧脚本（D6）+ 修 A17 笔误 | 未开始 |
| 3 | 接入 codex（形态待定：skill / MCP） | 待用户说明 |
| 4 | 进实战项目压测 collaboration | 待用户指定 |
| 5 | 真 CI | 用户裁决：**放后面** |

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
