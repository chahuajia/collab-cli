# collab-cli

`collab` —— 驱动 **COLLABORATION 知识库**（markdown + frontmatter）的命令行工具。

> 这个文件此前是**空的**（0 字节）。十个命令、一套校验器，却没有任何入口文档 ——
> 属于"实现了但没写下来"。这里补上。

## 安装与运行

```sh
npm install
npm run build          # 产物在 dist/，bin/collab.js 从那里加载
node bin/collab.js --help
```

定位工作区有三种方式，优先级从高到低：`--dir <path>` → 环境变量 `COLLAB_DIR`
→ 从当前目录向上找 `.git`，再探测两种布局（`COLLABORATION/` 子目录，或顶层
`agreements/` 等目录）。

## 命令

| 命令 | 作用 |
| :--- | :--- |
| `collab new <type> [id] [--dry-run]` | 从模板建条目（自动写 `aliases`、`author`） |
| `collab parse <src.txt\|-> [--out] [--stdout]` | A17 文本 → `bundle.json`（按现状推断 action） |
| `collab apply <bundle.json> [--dry-run] [--index] [--commit]` | 落盘：**要么全部成功，要么一个字节都不写** |
| `collab index [dir]` | 增量同步 `_index.md`（保留人工列） |
| `collab validate [--json]` | 全量校验（链接 / 索引 / id / 目录 / 生成物） |
| `collab catalog [--out] [--stdout]` | 生成 `catalog.json`（agent 的路由表） |
| `collab fix [--dry-run]` | 补齐机械字段（**只补不删**，补不了就报错） |
| `collab memory [--max-age <days>]` | 检查工作记忆里"声称当前状态"的文件是否过期 |
| `collab commit -m <msg>` | validate + `git add` + `git commit` |
| `collab push` | validate + `git push` |
| `collab mcp [--dir <path>]` | 以 **MCP 服务器**运行（stdio），供 AI 客户端调用 |

退出码：`0` 通过、`1` 有阻断性问题**或参数错误**。

> ⚠️ `validate.ts` 的文档头写着"`2` = 参数错误"，但代码里从未产生过 `2`
> （未知命令与缺参数都由入口统一退 `1`，且命令普遍用 `parseArgs({strict:false})`，
> 未知选项被静默忽略）。见 `working-memory/tasks/cli-audit/findings.md` F4 ——
> 要么实现它，要么删掉这个承诺；**不写一个不存在的退出码**。

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
| `collab_parse` | A17 文本 → bundle（不落盘） |
| `collab_apply_plan` | 预演落盘计划（**永不写盘**） |

**没有 `commit` / `push` 工具，也不打算有** —— "AI 不 commit、不 push"这条规则
在这里不是散文，而是**工具表里不存在这一项**。

## 架构

六边形分层，由 ESLint 强制（`domain` 只能依赖 `domain/` 与 `shared/`）：

```
src/domain          纯逻辑：条目、校验规则、parse、apply 计划
src/application     用例：校验、落盘、catalog、bundle 组装
src/infrastructure  IO：文件系统、git、sha256、边界解析
src/mcp             MCP 协议与工具（不 import cmd*）
src/cli             命令与渲染
```

`npm run check` = typecheck + lint + 全部测试（当前 595 tests / 43 files）。
