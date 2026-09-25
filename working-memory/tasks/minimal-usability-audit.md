# 最小可用性排查（2026-09-26）

> **怎么读**：本文是**一次实测的存档**，不是规范。每条结论都写了命令，能重跑。
> 判据借用 KB 的 `patterns/reproducible-verification`：**能写成检查的，别留成"我试过"**。

## 方法

从"使用者第一次接触"的顺序走一遍：**装包 → 建 KB → 写第一条 → 过门禁 → 接进项目
→ 走 AI 粘贴通道 → 走 MCP → 提交/推送**。每步记**命令 + 退出码 + 实际输出**，
凡是与 `--help` / README / 生成物（AGENTS.md、README.md）承诺不符的，就是缺陷。

环境：干净目录装本地 `npm pack` 的 tgz（**不是**源码目录跑 `tsx`）—— 只有装完之后，
`init` 的输出才是使用者看到的样子。

## 走通的路径（无缺陷）

| 路径 | 命令 | 结果 |
| :--- | :--- | :--- |
| 建 KB | `init --profile kb` | 骨架含六个 kind 目录的 `_index.md`；`validate` 不带 `--dir` 即 0/0 |
| 写第一条 | `new pattern first` → `index` → `catalog` → `validate` | 1 entries / 0 issues |
| 六种 kind | `new skill/agreement/workflow/pattern/adr/integration` | 全部 exit 0（adr 见下方缺陷 3） |
| 代谢出口 | `retire <id> --dormant --reason "过时: …"` / `retire --candidates` | 前者改 status，后者只报告 |
| 只补不删 | `fix` / `fix --dry-run` | 补 `aliases`；补不了就报错（不猜） |
| AI 粘贴通道 | `parse <file>` / `parse -`（stdin） → `apply --dry-run` → `apply --index` → `validate` | 真产物夹具原样落盘 |
| MCP | `mcp --dir <kb>`：`server/discover` / `initialize` / `tools/list` / `tools/call` | 6 个工具；**stdout 无非 JSON 行**（协议纯度）；新契约在 MCP 里同样生效 |
| 项目接 KB | `init --kb <路径>` → `node scripts/collab-validate.mjs` | 生成的 wrapper 能跑；默认 `npx --yes @chahuajia/collab-cli@^0.5` 实测可解析（走网络） |
| 门禁 | `commit -m` / `commit --no-validate` / `push` / `push --dry-run` / `commit`（缺 `-m`） | validate 红则拒绝；绿灯 push 成功；缺 `-m` 明确报错 |
| help 承诺的选项 | `validate --json` · `catalog --stdout` / `--out` · `new --dry-run` · `index --dry-run` · `apply --json` | 全部存在且可用 |

## 发现与处置（8 条）

| # | 缺陷 | 严重度 | 处置 |
| :--- | :--- | :--- | :--- |
| 1 | `--help` 写着 `init [--profile starter]`，而 `starter` **不是合法值**（当场报"未知 --profile"） | 高（第一屏就骗人） | 改成从 `SUPPORTED_PROFILES` **派生**；`help.test.ts` 加断言钉住派生关系 |
| 2 | `new adr <id>` 生成的条目**过不了自己的 validate**（4 个 `MISSING_SECTION`：背景/决策/后果/替代方案）—— 模板只有一份模式语言骨架 | 高（每条 ADR 起步即红） | `templates.ts` 按 kind 分两套骨架；E10 从"只测 skill"扩到**六种 kind 参数化** |
| 3 | kb 骨架的 `AGENTS.md` 写"进度与决策在 `working-memory/`"，而 kb profile **不建**该目录（真实 KB 的存在前提就是"WM 不在 KB 仓"） | 中 | 改成"不在本仓库 —— 属于主体仓" |
| 4 | `fix` 对**带 BOM** 的文件报 `frontmatter not found`（loader 剥 BOM、fix 不剥 → "validate 看得见、修不了"） | 中（Windows 编辑器默认产物） | `addIdAlias` 与 `parseDocument` 同判据：剥 BOM 定位、**写回时保留 BOM** |
| 5 | `fix` 把 `aliases: []` 补成 `aliases: [, S30]` —— **非法 YAML**（"补一个小字段"改坏整个文件） | 高 | 空内联数组走 `[id]` 分支；测试断言"解析得开"而非"字符串像" |
| 6 | `fix` 会把 CRLF 文件**静默改成 LF** | 中 | 按原换行符写回；测试钉住 |
| 7 | KB `AGENTS.md` 的症状表把毕业命令写成 `retire <id> --enforced <路径> --confirm`，**漏了 `--reason`**（两条路径都必填） | 中（照文档抄就报错） | 补上 `--reason`，并在条目里注明"实测" |
| 8 | `tsc` 不清 `outDir` → **删掉的模块照样打包发布**（0.5.1 实测带 5 个无源模块） | 高 | `npm run build` 先清 `dist`（`scripts/clean-dist.mjs`）；包 98 → 91 files |

## 未修（观察项，需人拍板）

| 观察 | 现状 | 为什么没动 |
| :--- | :--- | :--- |
| `collab memory` 在 kb 仓库报 `✖ working-memory/ not found` | 退出码 1、信息简短 | 语义上**正确**（KB 仓确实没有 WM），但第一眼像故障。改成"这与本仓无关"是文案判断，归人 |
| `new` 之后 `validate` 必红（缺 `_index.md` + `catalog` 过期），要跑 `index` + `catalog` | 报错自带修复建议（`MISSING_FROM_INDEX` / `CATALOG_STALE` 都写了该跑什么） | 可接受：**自描述的错误**≈可执行的下一步。加"下一步"提示会让批量 `new` 变吵 |
| wrapper 默认指向**已发布的**版本（当前 0.5.1），而 HEAD 已换契约 | 0.5.2 发布后自然收敛 | 发布是人的动作；`RELEASE.md` 一、二节已列清单 |

## 一条诚实的元结论

**这 8 条没有一条是"读了某个条目"拦住的** —— 它们是**逐条跑出来的**（装包、跑一条命令、看退出码）。
所以本轮**没有**向 KB 的 `meta/interceptions.md` 追加拦截行：账本记的是"某条目真的拦住了一个错误"，
而这里发生的是"**没有东西在拦**"（模板只测一种 kind、BOM 从没人试过、help 的取值手写）。

这与 KB 自己的诚实说明一致（"读了有没有用**至今不可判定**"）。若要说本轮有什么可搬走的：
**"最小可用性"不是一条一条读出来的，是能跑出来的一串命令** —— 而其中价值最高的一类是
**"照文档抄一遍"**（缺陷 1、3、7 全是这么来的：文档写什么，就照着敲什么，然后看它红不红）。

## 关联

- 契约变更（同一天的上一轮）：`tasks/parse-adr0012/handoff.md`
- 发布清单：`RELEASE.md`
- 候选队列：`working-memory/candidate-queue.md`（"文档面取值手写 → 漂移"已标吸收）
