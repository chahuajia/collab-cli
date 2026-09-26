# collab-cli

`collab` —— 驱动 **COLLABORATION 知识库**（markdown + frontmatter）的命令行工具。

> 这个文件此前是**空的**（0 字节）。十几个命令、一套校验器，却没有任何入口文档 ——
> 属于"实现了但没写下来"。这里补上。
>
> **命令与选项的权威是 `collab <cmd> --help`**（本表由 `scripts/__tests__/cli-docs.test.ts` 对照它检查）。

## 安装与运行

```sh
pnpm install           # 本仓用 pnpm（仓库里只有 pnpm-lock.yaml；npm 锁文件在 .gitignore 里）
pnpm run build         # 产物在 dist/，bin/collab.js 从那里加载
node bin/collab.js --help
```

> **只用一种包管理器。** 2026-09-26 实测：两个仓的 CI 都写着 `npm ci`，而仓里只有
> `pnpm-lock.yaml` —— `actions/setup-node` 找不到锁文件，后面每一步都 skipped，
> **CI 从来没跑起来过**，而本地 `npm run check` 一直是绿的。本地绿 ≠ CI 绿。

定位工作区有三种方式，优先级从高到低：`--dir <path>` → 环境变量 `COLLAB_DIR`
→ 从当前目录向上找 `.git`，再探测两种布局（`COLLABORATION/` 子目录，或顶层
`agreements/` 等目录）。

## 命令

| 命令 | 作用 |
| :--- | :--- |
| `collab new <type> [id] [--dry-run]` | 从模板建条目（自动写 `aliases`、`author`） |
| `collab parse <src.txt\|-> [--out] [--stdout]` | 粘贴的 AI 输出 → `bundle.json`（块边界 = 条目自描述 frontmatter；按现状推断 action） |
| `collab apply <bundle.json> [--dry-run] [--index] [--commit]` | 落盘：**要么全部成功，要么一个字节都不写** |
| `collab index [dir]` | 增量同步 `_index.md`（保留人工列） |
| `collab validate [--json]` | 全量校验（链接 / 索引 / id / 目录 / 生成物） |
| `collab catalog [--out] [--stdout]` | 生成 `catalog.json`（agent 的路由表） |
| `collab fix [--dry-run]` | 补齐机械字段（**只补不删**，补不了就报错） |
| `collab retire <id> --dormant --reason "<分类>: <证据>" [--dry-run]` | 让条目**退出路由索引**（不是删除）——被冷落（过时 / 重复 / 表达差 / 未成熟） |
| `collab retire <id> --enforced <path> --confirm --reason "<分类>: <证据>"` | 同上，另一条路径：**已毕业**（内容已被测试/工具固化）。`--confirm` 是必填的确认门 |
| `collab retire --candidates [--grace-days <n>]` | 列出孤岛条目（**只报告，不写盘**；默认 30 天宽限） |
| `collab memory [--max-age <days>] [--max-candidate-age <days>]` | 检查工作记忆里"声称当前状态"的文件是否过期 / 候选池挂多久没 harvest |
| `collab commit -m <msg>` | validate + `git add` + `git commit` |
| `collab push [--remote <name>] [--branch <name>]` | validate + `git push` |
| `collab mcp [--dir <path>]` | 以 **MCP 服务器**运行（stdio），供 AI 客户端调用 |

> `retire` 的 `--enforced` 那条**必须同时给 `--confirm`** —— 少了它命令直接拒收
> （本表 2026-09-26 之前就漏了它，属于"照文档抄就报错"）。

### `--enforced` 的 `<repo>` 是什么

值的形式是 **`<repo>:<path>`**，`<repo>` 目前只认三个名字：
`collab-cli` / `collaboration` / `evolutionary`。

本机位置按这条链找（**都不成立就是"无法判定"，不是"不存在"**）：

1. `COLLAB_CLI_DIR` / `COLLAB_KB_DIR` / `EVOLUTIONARY_DIR`（逐仓覆盖）；
2. `COLLAB_PROJECTS_DIR`（一次给共同父目录），或从包位置推导 + 内置的相对布局；
3. 都不成立 → 报"无法判定"。写 `retire --enforced` 时会给警告后放行；
   事后 `collab validate --check-enforced` 会报 **`ENFORCED_UNCHECKED`（WARNING）** ——
   它**不是错**（拿不到业务仓的机器不该全红），但**必须出声**：
   否则"验过了"和"没验成"在输出上分不出来。

退出码：`0` 通过、`1` 有阻断性问题或参数错误。**没有退出码 2**
（未知命令 / 缺参数 / 校验红 都走 `1`）。

## MCP 接入

```sh
codex mcp add collab -- node <repo>/bin/collab.js mcp --dir <knowledge-base>
codex mcp list
```

服务器在 stdio 上说话，支持**两个协议时代**：`2026-07-28` 起 MCP 无状态
（版本随每个请求的 `_meta`，入口是 `server/discover`），此前是 `initialize` 握手。

暴露 6 个工具，**全是只读或只出计划**：

| 工具 | 作用 |
| :--- | :--- |
| `collab_catalog` | 路由表：先定位，再读条目正文（上下文成本从 O(n) 降到 O(命中数)） |
| `collab_read` | 按 id 或路径读单条（`bodyOnly` 可只取正文） |
| `collab_search` | 在 id / 标题 / 正文里搜，返回片段与排序 |
| `collab_validate` | 结构化 Issue 列表（`scope=standard｜content`） |
| `collab_parse` | 粘贴的 AI 输出 → bundle（不落盘；跳过的块走 `warnings`） |
| `collab_apply_plan` | 预演落盘计划（**永不写盘**） |

**没有 `commit` / `push` 工具，也不打算有** —— "AI 不 commit、不 push"这条规则
在这里不是散文，而是**工具表里不存在这一项**。

## 架构

六边形分层，由 ESLint 强制（`domain` 只能依赖 `domain/` 与 `shared/`）：

```
src/domain          纯逻辑：条目、校验规则、parse 的问题工厂、apply 计划
src/application     用例：校验、落盘、catalog、bundle 组装
src/infrastructure  IO：文件系统、git、sha256、边界解析
src/mcp             MCP 协议与工具（不 import cmd*）
src/cli             命令与渲染
```

`npm run check` = typecheck + lint + 全部测试。

`npm run test:ci` = 同样的测试，但**跳过会失败**：任何 `skip` 都必须写进
`.vitest-skip-allowlist.json` 并说明理由 —— 跳过 = 没验，不是验过了。
（本仓曾有一处写死绝对路径 + `skipIf` 的测试：CI 上静默跳过、本机断言过时而红，
两种"绿"的含义完全不同。见 `scripts/assert-no-skips.ts`。）

`npm run memory` = 会话开始那一步：工作记忆还配得上被信任吗（`memory:draft` 只读，
`memory:attest` 记录已对账的 HEAD）。判据在 `scripts/lib/freshness.ts`，有单测。

### 两种 working-memory，别混

`files` 里**没有** `working-memory/` 与 `scripts/` —— 它们**不随包发布**，是本仓的开发资产：

| | 本仓开发用的 | 使用者自己用的 |
| :--- | :--- | :--- |
| 在哪 | 本仓 `working-memory/` | **他们自己仓**的 `working-memory/` |
| 谁生成 | 人写 | `collab init`（默认 consumer profile）生成骨架 |
| 谁检查 | `npm run memory`（盯**这三个**仓的 HEAD，`.attested.json` 对账） | `collab memory`（产品命令：WM 里"声称当前状态"的文件是否过期、候选池挂多久） |

所以 `npm run memory*` 是 **checkout 里才有意义**的开发仪式 —— 和 `npm test` 一样。
装了包的人在 `node_modules/@chahuajia/collab-cli` 里跑它会失败（`scripts/` 与 devDependencies
都不在包里），那不是缺陷；**产品侧对应的能力是 `collab memory`**。
另外 `npm run memory` 的默认值绑定**本机三仓布局**（见 `repoRoots.ts`），
对使用者没有意义 —— 这是故意的：它读的是"作者本机的状态"，不是通用功能。

> 测试条数不写在这里 —— 手写的可计算量必然腐烂（本行曾写"595 tests / 43 files"）。
> 想要数字就跑 `npm test`。
