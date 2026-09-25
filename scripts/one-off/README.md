# one-off —— 跑过的一次性迁移（**不是工具**）

> 这些脚本**已经跑完**。留在这里是给"当时到底改了什么"留个可读的说明，
> 不是给日常使用留的入口。

| 脚本 | 做过什么 | 现状 |
| :--- | :--- | :--- |
| `add-aliases.ts` | 给"文件名 ≠ frontmatter.id"的条目补 `aliases` | 被 `ID_NOT_IN_ALIASES` 规则取代（`collab fix` 可机械补） |
| `add-author.ts` | 补 `author` 字段 | 同上：模板已带，规则已管 |
| `add-dates.ts` | 补 `created` / `updated` | 同上 |
| `migrate-add-falsifier-enforced.mjs` | 补 `enforced: null`（ADR-0011 基座变更） | 迁移完成；新条目由模板带 |
| `migrate-write-entry.mjs` | 把 `writeEntry({...})` 换成具名工厂 | 测试已迁完 |
| `rename-entry-kind.mjs` | 把 `runCliSuccess(` 改成 `toSucceed(`（**改的是本仓 src**） | 一次性 |

## 为什么只有三个是 `.ts`

前三个是**知识库数据**的迁移 —— 换个 fork、换份老数据，它们可能还要再跑一次，
所以它们进了类型检查，并且把"哪些目录算条目"从 `EntryKindDir` **派生**
（原先手抄的那份**少了 `integrations`**：集成层的条目会被静默跳过）。

后三个改的是**本仓 `src/` 在 2026-09 那次重构中的现场** —— 那次重构早已完成，
它们永远不该再跑。留成 `.mjs` 是**刻意的**：它们是标本，不是工具；
给标本加类型只会让人误以为它还活着。

## 为什么单独放一层

`scripts/` 下**只有活的工具**（`clean-dist.mjs` 构建前置、`assert-no-skips.mjs` 门禁）。
一次性迁移混在里面会有两个代价：

1. **它看起来是工具** —— `package.json` 里一度有 `script:add-author` 这样的别名，
   等于对外承诺"这是可用的东西"（[[S10-collab-cli]] 反面：不要把不存在/不维护的东西写进使用说明）。
2. **没人会维护它** —— 它只跑一次，之后任何契约变更（目录、字段）它都不会跟着动，
   却仍会被当成"能跑"的入口。

**注意**：这些脚本里的 `ENTRY_KIND_DIRS` 之类的清单是**当时的手抄**，今天已经可能与
`EntryKindDir` 漂移。真要用它们，先照现契约核对一遍，别直接跑。

**删除也是选项**（git 历史里都在）—— `working-memory/parking-lot.md` 有一条未决：
"是否合并成通用迁移工具（等第三次迁移需求）"。在那之前，这里只是档案。

## 2026-09-26 用户拍板

1. **三个标本（`.mjs`）留着** —— 不删。
2. **不给标本做美容**（不清 `no-magic-numbers` 之类的 warning）——
   它们是标本，不是待打磨的代码。
