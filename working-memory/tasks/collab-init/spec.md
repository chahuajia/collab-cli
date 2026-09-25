# Spec: `collab init`

**状态**：**待拍板**（A10 / W8 的「规格」阶段；未写测试、未写实现）
**作者**：codex（AI 提议）
**日期**：2026-09-25
**关联**：[[A10]] [[A13]] [[W8]] · KB `integrations/adoption-guide.md` · `tasks/collab-apply/`

---

## 上下文

`adoption-guide.md` 写了接入一个新项目的 7 步（先门禁 → 接 CI → 两账本 → 薄入口 →
入库门槛 → 三条出口 → 才写正文）。**问题：这 7 步现在全是手工。**

现状证据：

- 12 个命令里**没有脚手架**（`new/apply/parse/mcp/memory/catalog/index/validate/fix/retire/commit/push`）；
- `src/application/InitUseCase.ts` 与 `src/cli/commands/init.ts` 是 **0 字节空壳** ——
  "从未来设计"的遗留：先建了文件，从没实现。**空文件比没有更糟**，它让下一个人以为功能存在；
- 于是接入成本全落在人身上：复制模板、写 AGENTS、接 CI、建账本 —— 每次重做，且每次做得不一样。

一句话：**"引导"不该靠一篇文章，该靠一个命令。**

## 目标

一条命令，把空目录变成"门禁已接、账本已建、入口已写"的最小可运行工作区，**并且只增不改**。

| # | 目标 | 可观察结果 |
| :--- | :--- | :--- |
| G1 | 一次装好 | 生成 6 个文件（见清单），`collab validate` **当场 0 issues** |
| G2 | 幂等 | 再跑一次：全部跳过，exit 0，文件**逐字节不变** |
| G3 | 只增不改 | 已存在的目标文件**绝不覆盖**（用户改过的东西不能被脚本吃掉） |
| G4 | 可审 | `--dry-run` 打印"将创建 / 将跳过"，**不写任何字节** |
| G5 | 不越权 | 不碰 `.git`、不 init、不 commit、不 push（[[A7]]） |

## 非目标

- ❌ 不做 git 初始化 / 不建远程 / 不提交。
- ❌ 不创建全部 11 个 `CONTRACT_DIRS` 空目录 —— 空目录无害也无用，让 `new` / `index` 按需建。
- ❌ 不预置任何条目正文（不塞 pattern / skill 内容）。
- ❌ 不安装 collab-cli 自身（见 D1）。
- ❌ 不做 KB 迁移、不导入上游条目（那是 `apply`）。

## 接口

```bash
collab init [--dir <path>] [--profile starter] [--with-ci] [--with-hook] [--dry-run] [--json]
```

| 选项 | 行为 |
| :--- | :--- |
| `--dir <path>` | 目标工作区（沿用全局三层定位；缺省 = 当前目录） |
| `--profile starter` | 目前只接受 `starter`；未知值**报错退出**（不静默降级） |
| `--with-ci` | 额外生成 `.github/workflows/validate.yml` |
| `--with-hook` | 额外生成 `.husky/pre-push`（无 `.husky/` 时跳过并提示） |
| `--dry-run` | 只打印计划 |
| `--json` | 机器可读输出（计划 + 结果） |

## 生成清单（profile=starter）

| 路径 | 内容 | 依据 |
| :--- | :--- | :--- |
| `AGENTS.md` | 薄入口：一句话 + 阅读顺序 + **3 行**症状表 + 边界（不 commit/push） | A13：≤100 行 |
| `README.md` | 一句话：这是什么、入口在哪 | 人工入口 |
| `meta/interceptions.md` | 收益账本：表头 + 记账格式 + 判据 + 反面 | adoption-guide 第 3 步 |
| `meta/known-gaps.md` | 缺口账本：表头 + "必须有找过 / 写检索路径 / 关闭条件可验证" | 成对才有方向 |
| `meta/pruning-policy.md` | 三条出口（dormant / graduated / known-gaps）+ 红灯配动作 | M4 / M5 / J11 |
| `scripts/collab-validate.mjs` | **唯一 CLI 调用点**（CI / hook 都只调它） | D1 |

> `catalog.json` 与 `_index.md` **不生成** —— 它们是 `collab catalog` / `collab index` 的产物。

## 行为规格

### 1. 计划（plan）—— 与 `apply` 同构：先算完，再写第一个字节

| 检查 | 行为 |
| :--- | :--- |
| 目标路径存在且是文件（不是目录） | 拒绝 |
| 生成物已存在 | 记入 **skip 列表**，不覆盖，继续 |

### 2. 写入

按清单顺序写；全部 **UTF-8 无 BOM + LF**（带 BOM 会让部分工具读成乱码，KB 有历史事故记录）。

### 3. 自检

写完后**复用 `ValidateUseCase`**（不重写规则）跑一次：

- 0 issue → exit 0，打印"下一步"三行提示；
- 有 issue → **不回滚**（与 `apply` 一致，git 可恢复），exit ≠ 0 并列出。

## 验收（先写测试，再写实现）

| # | 场景 | 期望 |
| :--- | :--- | :--- |
| I1 | 空目录 init | 6 个文件出现；`validate` **0 issues**；exit 0 |
| I2 | 连续跑两次 | 第二次全部 skip；两次后内容逐字节相同（幂等） |
| I3 | 已存在用户自写的 `AGENTS.md` | 跳过，**内容不变**，报告 skip |
| I4 | `--dry-run` | 打印计划；目标目录**不产生任何文件** |
| I5 | 编码 | 全部 UTF-8 **无 BOM**、LF |
| I6 | init 后立即 `collab new agreement A1` | 成功；`validate` 仍 0 |
| I7 | `--with-ci` | 生成 CI 文件；默认不生成 |
| I8 | `--with-hook` 且无 `.husky/` | 不生成，提示原因；exit 0 |
| I9 | `--profile=full`（未知值） | 报错退出，**不写任何文件** |
| I10 | 不碰 git | 前后 `git status` 只多出生成物；无 commit |
| I11 | 目标目录不存在 | 创建目录树；exit 0 |
| I12 | 生成物里的链接 | `linksResolve` 不报错 —— AGENTS 里**不得出现指向未落盘条目的双链** |

> I12 是硬要求：starter 最容易犯的错，是写一堆指向"上游 KB 条目"的死链 ——
> 那等于**教新用户引用不存在的东西**。

## 反面

- **不要覆盖**任何已存在文件 —— "帮你更新一下"是这类命令最常见的破坏行为。
- **不要建空目录**充数 —— `UNDECLARED_DIR` 只看含文件的目录，空壳只会误导。
- **不要预置条目正文** —— 预置的 pattern 会变成没人读的"出厂设置"，且绕过 `falsifier` 门槛。
- **不要在 starter 里写死上游 KB 的绝对路径** —— 换台机器就是死链。
- **不要做 git 操作** —— 初始化仓库是人的决定，不是工具的决定。
- **不要静默降级未知 `--profile`** —— 打错字就装错东西，是最难查的故障形态。

## 未决问题（需要人拍板）

### D1（已收敛）：让 CI / hook **都不直接写 CLI 调用**

原问题：CI 与 pre-push 各自硬编码"怎么调 CLI"，于是 CLI 来源这一个决定，被复制到两处 —— 改一次要改两处（典型的 `derivation-over-copy`）。

**收敛方案：starter 生成一个调用点**，CI 与 hook 都只调它：

```js
// scripts/collab-validate.mjs —— CLI 来源只出现在这一处
const CLI = process.env.COLLAB_CLI ?? 'npx --yes collab-cli@^1';
```

于是 D1 从"卡住实现"降级为"**一个环境变量的默认值**"：本机可用 `COLLAB_CLI=node /path/to/dist/cli/index.js` 覆盖，
别人机器上走 npm。找不到 CLI 时**打印三种安装方式**并 exit ≠ 0（不静默通过）。

默认值选 `npx collab-cli@^1` 的前提是**先发布到 npm**。D1 的这个前提仍未完成，见 D2。
### D2. `--with-ci` / `--with-hook` 默认值？

**推荐默认关**：因为 `npx collab-cli@^1` 依赖 npm 发布（未完成），默认开会让新用户第一次跑就失败。**发布后翻成默认开。**

### D3. 要不要生成 `meta/base-contract.md`？

**推荐不生成**：KB 的 base-contract 写着"权威在代码里（`CONTRACT_DIRS`）"，starter 再抄一份就是第二份真相源。

### D4. starter 的 `AGENTS.md` 症状表写哪 3 行？

此时它还没有任何条目可指。**推荐**：写 3 行通用入口 + 一行注释（"第 4 行起由你加；加不上就记 `known-gaps`"）。

### D5. 是否允许在非空目录上 init？

**推荐允许**（只增不改已保证安全），但**打印警告**列出跳过的文件。

### D6. 空壳文件处置

`InitUseCase.ts` 与 `commands/init.ts` 实现本规格时就地填实；
另三个空壳（`rules/index.ts` / `GitAdapter.ts` / `ConsoleReporter.ts`）建议**删除** ——
已被 `rules/*` / `gitRunner.ts` / `renderReport.ts` 取代，空文件只会误导。

## 关联

`tasks/collab-apply/spec.md` · `tasks/collab-parse/spec.md` · KB `integrations/adoption-guide.md`