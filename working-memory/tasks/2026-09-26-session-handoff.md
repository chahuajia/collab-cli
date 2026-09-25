# HANDOFF —— 2026-09-26 会话（collab-cli + COLLABORATION）

**读者**：新开对话的 agent（不是给用户的作业）｜**写于**：2026-09-26
**性质**：**会话级**交接 —— 跨了 6 个关切。任务级细节在这三份里，**不要重复读**：

| 要查什么 | 去哪 |
| :--- | :--- |
| parse 契约变更（ADR-0012） | `tasks/parse-adr0012/handoff.md` |
| 三轮最小可用性排查（11 个缺陷 + 全部命令） | `tasks/minimal-usability-audit.md` |
| `src/cli` 与 `scripts` 的 DDD 整理 | `tasks/ddd-refactor-cli.md` |
| 单条决策（20+ 条，含理由与代价） | `decisions.md` |

---

## 0. 30 秒定位

| 项 | 状态（本文写时**实测**） |
| :--- | :--- |
| 仓 | `collab-cli`（工具链，真相仓）· `collaboration`（长期知识库） |
| 门禁 | `npm run check` = 0；`npm run test:ci` = **776 通过 · 0 跳过 · 55 files** |
| 打包 | `npm pack` → **93 files**；`.test.js`/`.map` 各 0 · **无"已删源"残留** |
| KB | `collab validate` → **129 entries / 0 issues** |
| 版本 | `package.json` = **0.5.1**（已发布）；**0.5.2 未发布**（清单见 `RELEASE.md`） |
| 工作区 | **两仓改动全在，未 commit、未 push**（AI 不 commit、不 push） |

## 1. 这一轮做了什么（按关切，不按时间）

| # | 关切 | 产物 | 怎么验的 |
| :--- | :--- | :--- | :--- |
| 1 | **parse 的边界契约换掉**（人为分隔符 → 自描述 frontmatter） | 实现迁到 `infrastructure/parsing`；产出形状 `{files, warnings}`；新增 `PARSE_PATH_MISMATCH`；真产物夹具入仓 | 真产物**原样**落盘 2324 bytes；污染形态不再整单拒收 |
| 2 | **"承诺 vs 现实"清扫** | `init` 三处不再让人跑未生成的 wrapper；kb 骨架从"工具链认不出"变成自识别 + 立刻可用；`new adr` 不再生成过不了自己 validate 的条目 | 装机后逐条跑；E10 从 1 种 kind 扩到 6 种 |
| 3 | **发布卫生** | `build` 先清 `dist`（实测已发布的 `0.5.1` 带着 **5 个无源模块**）；`RELEASE.md` 按实测重写 | `npm pack` 文件清单逐项核对 |
| 4 | **`src/cli` 的 DDD 整理** | `cli/lib/` 整个消失；`new` 决策抽成 `application/CreateEntryUseCase`；配额规则归 domain；条目章节清单**单一来源**；删掉无用的可选格式化（dev/prod 曾跑不同路径） | 772→776 测试全程绿 |
| 5 | **`scripts` 进 TS + 分层** | 门禁判据（跳过记账）抽成纯函数 + 单测；`tsc -p tsconfig.tooling.json` 与 `eslint src scripts` 覆盖之；数据迁移转 TS 且目录**从领域派生**（实测原手抄清单**少了 `integrations`**）；三个标本保留 | `npm run test:ci` 即新的 TS 版；迁移脚本对真库 `--dry-run` 129 条幂等 |
| 6 | **三轮最小可用性排查** | 11 个缺陷（含 3 个"照文档抄就报错"、4 个"会改坏文件/产物"）；help 的选项清单加守卫测试 | 装 `npm pack` 的包跑；布局 A / 毕业路径 / stdin / 逐个选项 |

## 2. 这一轮真正学到的东西（**扩展后的判据**）

> 下面每条都从**多个**缺陷里长出来，附"现场证据"（缺陷见 `tasks/minimal-usability-audit.md`）。
> 写在这里是因为：**下一次撞上同形状的问题时，你要能认出它，而不是再花一天。**

### A. 契约的形状不对时，补丁追不上
外部输入反复以"多余包装"出现 → 先问**契约是不是在管包装**。ADR-0012 把边界从"分隔符长什么样"改成"内容自描述"（frontmatter 里本来就有 `id`/`type`），三种污染同时消失。
**反面**：内部序列化（格式由本方完全控制）不需要这种宽容。

### B. "跳过"必须配"出声"；**成功路径也要能带 warning**
`Result<T,E>` 表达不了"成功但有警告"，于是"宽容"必然退化成"静默丢弃"。判据因此写成：**有阻断级才失败，warning 一律露面**（不是"有 issue 就失败"，也不是"没 issue 就算过"）。
**现场**：`skipped` 通道 + 产出形状改 `{files, warnings}`。

### C. 能派生的别手写（同一事实写两处必然漂移）
这一轮**抓到五次**：条目章节清单（规则 vs 模板）、help 的 `--profile starter`、迁移脚本的目录清单（少了 `integrations`）、版本号、help 的选项清单。
**判据**：写下任何清单前先问"它的源头在哪"；有源头就派生，没源头就先问"该不该在"（多数该删）。
**反面**：**标本**除外 —— 它们不需要一致，需要的是"让人看出它不再维护"。

### D. 验收证据必须在仓里、在 CI 里
把 `D:\下载缓存\test.txt` 当验收标准 = 借来的证据：今天比真的还真，明天随下载目录一起消失；而且"逐字节一致"这条不变量**挂在 git 的换行策略上**。
**判据**：能写成检查的，别留成"我试过"；**"这个文件如果写错了，谁会红？"** 答不上来就是逃逸层。

### E. 逃逸层：`scripts/*.mjs` 不受任何检查
它既不在 `tsc` 里、也不在 `eslint src` 里、也不在 `vitest include` 里 —— 而它打印的正是"验过了 / 没验"的分界线。**门禁脚本的可信度曾低于任意一个 fixture。**

### F. 默认值照抄"用户已经会的那条链"
作者标识照抄 git：`--author` > `GIT_AUTHOR_NAME/EMAIL` > `git config user.name/email`。**静默回落是最坏的惊奇**：`--author ""` 悄悄回落到 git 身份 —— 输入端写了东西没生效却不报，用户会带着错误信念继续。
**判据**：输入给了东西却不生效时，要么用它、要么报错，**不能当没看见**。

### G. 深查要**换维度**，不是换样例
前两轮我在同一维度加样例（更多 kind、更多污染形态），盲区却在维度上：**布局 A**（`COLLABORATION/` 子目录）与**毕业路径**（`retire --enforced`）是代码里明确写着"支持"、却**从未端到端跑过**的分支。
**判据**：列"支持什么"时，每条注明"上次真的跑通是什么时候"；答"从没跑过"= 未知，不是"大概没事"。

### H. 生成物也要核实（不是只核实源）
模块从 `cli/lib` 移到 `application` 后，typecheck/lint/测试全绿，但 `dist/` 里**旧编译产物还在**，而 `files` 收整个 `dist/` → 删掉的模块照样发布（已发布版实测带 5 个）。
**判据**：改动会碰到的"实现者"包含**生成物**（构建产物、打包内容、生成文件）。

### I. 环境与平台的隐形前提
BOM（Windows 编辑器/`Set-Content` 默认写）让 vite 解析 `package.json` 当场失败；`core.autocrlf=true` 让"逐字节一致"变成依赖；PowerShell 的文本管道会转码（所以 `parse -` 要用**字节流**验）。
**判据**：凡断言"内容一致"，先问**是什么在决定字节**（编辑器 / git / shell / 编码）。

### J. 用户的判断也是一种输入源
本会话两次由用户直接定调："标本留着、不做美容"、"默认值要参考成熟设计"。两次都不是我能从代码里推出来的——**遇到"整洁 vs 语义"这类取舍，先摆证据再问人**，比自作主张省事。

## 3. 未完成 / 待完善（**带判据与代价，不写"以后优化"**）

### 3.1 必须做（解锁发布）

| # | 事项 | 判据 / 代价 |
| :--- | :--- | :--- |
| 1 | **提交两仓改动**（collab-cli ~30 项、collaboration 2 项，全在工作区） | 建议分组：① parse 契约（已由人提交为 `fe10844`）② init/骨架修复 ③ 索引渲染器分层 ④ 构建清 dist ⑤ `src/cli` 与 `scripts` 整理 ⑥ 文档与 WM。**同类不再合并成大杂烩**：`RELEASE.md` 要引用这些提交 |
| 2 | **发布 0.5.2**：`npm version 0.5.2 && npm publish --access public` | 只有人能发。`RELEASE.md` 一、二节是清单；**第五节那段"诚实边界"别省**（含本轮新增的 parse 边界与 wrapper 解析语义） |
| 3 | **KB 侧两处**：`AGENTS.md` 症状表（已加 `--reason` 说明）、`meta/interceptions.md`（已加 1 行） | 都在工作区；`collab validate` = 129/0 ✓ |

### 3.2 应该做（有明确判据，但不必今天）

| # | 事项 | 判据 / 代价 |
| :--- | :--- | :--- |
| 4 | **`retire.ts`（309 行）/ `fix.ts` / `memory.ts` 的用例化** | `new` 已给出模板：决策进 `application/*UseCase`、I/O 用端口注入、命令只剩参数与输出。**代价**：`retire` 要连 `enforcedTargets` 端口一起抽，比 `new` 大 |
| 5 | **frontmatter 定位器还有两份**：`infrastructure/parsing/FrontmatterParser.parseDocument`（剥 BOM）与 `scripts/lib/entryFrontmatter.locateFrontmatter`（我按同一判据写的） | 两者语义已对齐并有注释，但仍是两份。要么合一，要么给 `scripts/lib` 补单测锁住（现在只有 `skip-accounting` 有测试） |
| 6 | **WM 红灯**：`collab memory` 报 6/7 个文件过期（8–9 天）；`working-memory/README.md` 的 `**更新**：` 仍是 09-25 | 本文件的规则写着"**这一行只能人写**"——我不刷。要灭灯得人决定每个文件"更新内容 还是 降级 `_archive/`" |
| 7 | **lint 还剩 8 条 warning**（3 条来自标本的 magic number + 5 条既有） | 按已拍板：**标本不做美容**；剩下 5 条是 `memory.ts` 的 `24/60/60/1000` 与 `FileWorkspaceLoader` 的 `-3`，要清就抽具名常量 |
| 8 | **KB 症状表是否加"AI 输出被整单拒收"一行** | 我判断**不加**（症状表路由"读哪条"，不路由"工具怎么切"），但要加的话落点是 `[[chatgpt-output-format]]` |

### 3.3 需要人拍板

| # | 事项 | 为什么我不定 |
| :--- | :--- | :--- |
| 9 | `scripts/one-off/` 三个 `.mjs` 标本：留（已拍板）／删／合并成通用迁移工具 | `parking-lot.md` 有未决："等第三次迁移需求" |
| 10 | `init --profile kb` 的骨架要不要再加 `inbox/`、`domains/` 等空目录（目前靠 `_index.md` 让六个 kind 目录可跟踪） | 属 `tasks/collab-init/spec.md` 的产品决策 |
| 11 | wrapper 的 CLI 默认值是 `@^0.5`（不是精确版本） | 语义：装到最新 0.5.x（含本轮的修复）。要钉死就改 `consumerValidateScript` |

### 3.4 **诚实清单：本轮没验过的维度**（别当成"验过了"）

| 维度 | 现状 |
| :--- | :--- |
| 路径含**空格/中文/Windows 长路径** | 只跑过普通路径 |
| **大 KB**（数千条）的 `validate` / `catalog` 性能 | 真库 129 条，未压过 |
| **并发** `apply`（两个进程同时落盘） | 只有单进程的乐观锁（`base_sha256`）被验过 |
| **真 MCP 客户端**（Claude Desktop / Cursor）联调 | 只用自写 JSON-RPC 脚本验过协议两面 |
| `push` 到**真远端**（GitHub + 认证） | 只用本地 bare 仓验过 |
| `parse -` 经 **PowerShell 文本管道** | 字节流（node spawn）验过；PowerShell 管道会转码，属使用注意 |
| `--with-ci` / `--with-hook` 生成物的**真实执行**（GitHub Actions / husky） | 只验过文件生成与内容 |

## 4. 怎么验证（一条条可复现）

```bash
# 工具链自查
npm run check                 # typecheck（两个 project）+ lint（src+scripts）+ test
npm run test:ci               # 门禁：跳过必须进 .vitest-skip-allowlist.json
npm pack --dry-run            # 包内容（应无 .test.js / .map / 无源残留）

# 装机后验收（**不要**在源码目录跑 tsx —— 装机才是用户看到的形状）
npm pack && npm i -g ./chahuajia-collab-cli-0.5.1.tgz
collab --version && collab --help

# 最小可用：两种布局
git init kbA && cd kbA && collab init --profile kb && collab validate   # 布局 B
git init kbB && cd kbB && collab init --profile kb --dir COLLABORATION  # 布局 A（从仓库根 validate）
collab new pattern first && collab index && collab catalog && collab validate

# AI 粘贴通道（真产物夹具在仓里）
collab parse src/infrastructure/parsing/__tests__/fixtures/real-ai-output.txt
collab apply bundle.json --dry-run && collab apply bundle.json --index

# 知识库自检
node dist/cli/index.js validate --dir <KB>
```

## 5. 边界与约定（**别踩**）

- **AI 不 commit、不 push**：改动留工作区（本轮已把两仓都留在工作区）。
- **真产物夹具必须 CRLF**：`.gitattributes`（`-text`）+ `.editorconfig`（fixtures 段 crlf）两面锁定；**别"顺手格式化"它**。
- **跳过的测试必须进 `.vitest-skip-allowlist.json`** 并写理由；`test:ci` 会红。
- **`.mjs` 标本别动**（已拍板：保留 + 不美容）。
- **`?` 先看 `decisions.md`**：本轮 20+ 条决策带理由与代价，别重新发明。
- **别在源码目录验"用户会看到什么"**：装 `npm pack` 的包再跑。
