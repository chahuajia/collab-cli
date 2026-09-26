# 发布检查单（最小可用版）

> **2026-09-25 改名**：`collab-cli` 在 npm 上**已被他人占用**
> （`yisang09 10`，1.6.1，2026-06 发布）——所以发布报的 "already 1.6.1" 不是 tag 问题，是重名。
> 现用作用域名 **`@chahuajia/collab-cli`**（自己的作用域，冲突面为零）。
>
> **已发布**：`0.5.0` / `0.5.1`（`npm view @chahuajia/collab-cli versions` 可查）。**本次目标：`0.6.0`**。
>
> **为什么是 0.6.0 而不是 0.5.2**：`0.5.1` 之后落了一条 **breaking**（KB 的 `ADR-0012`：
> `parse` 的块边界从 `===== FILE:` 分隔符换成条目自描述 frontmatter，且**不再用 slug 命名落盘文件**）。
> `parse` 契约是**对外接口**（粘贴协议），不是内部实现 —— 用 `0.5.2` 会让同一个号指两种行为。
> 按 semver，0.x 里 breaking 走 **minor**。（KB 的 `v4.x` 是另一条线，两者不要混。）

## 一、发布（两条命令）

```bash
npm version 0.6.0        # package.json 现在已经是 0.6.0（人工核对这一步可跳过）
npm publish --access public   # 作用域包必须显式 public
```

> 为什么还是 `0.x` 而不是 `1.0.0`：核心命令稳定、828 测试全绿，
> 但**还没有第二个真实使用者**。"1.0" 是承诺，现在给不出。
> （`0.6.0` 同理：它说的是"接口变过、按 semver 让位"，不是"成熟了"。）

## 二、发布前已验证（2026-09-26）

| 项 | 结果 |
| :--- | :--- |
| 测试 | **828 / 828** · 63 files（`pnpm run test:ci` → 828 通过 · 0 跳过；3 条在允许清单里声明） |
| 类型 | `tsc --noEmit` 干净 |
| Lint | `eslint src scripts` **0 error**（8 条 magic-number warning 为既有） |
| 打包 | `pnpm run build` **先清 dist** → `npm pack --dry-run` → **93 files / 114.4 kB**（unpacked 332.7 kB） |
| 包内容 | `dist/**/*.test.js` **0** · `.map` **0** · `.d.ts` **0** · `bin/collab.js` 就位 · **无"已删源"的残留** |
| 装机 | `--version` → **0.6.0**；`init` 两个 profile 均实测（kb 骨架 README 与 consumer wrapper 里的范围都是 `@^0.6`） |
| 自举 | 对真实 KB 跑 `validate` → **129 entries / 0 issues** |
| 依赖安装 | `pnpm install --frozen-lockfile` → "Lockfile is up to date"（**修锁文件前它是失败的**，见下） |
| 本地模拟 CI | `COLLAB_REAL_KB=<KB> pnpm run check` → 828 通过；`pnpm exec vitest run scripts/__tests__/kb-*.test.ts` → 通过 |
| 装机自检 | `npm run memory`（会话开始那步）能跑：`exit 1` + 逐仓列出未对账的提交（**这是当前正确状态**，签名归人） |

> ⚠️ **本地模拟 ≠ CI 绿**。上一次 "CI 是绿的" 就是从这个误会来的：
> `npm run check` 在本地连着几天全绿，而 GitHub 上两个 workflow 从没跑起来过（见第三节末）。
> 真正的确认只能等下一次 push 之后看 Actions。

> **为什么"先清 dist"要单独说**：`tsc` 不清 `outDir`，而 `files` 收的是整个 `dist/` ——
> 源文件一改名/移动，**删掉的模块照样被打包发布**。实测：已发布的 `0.5.1`（97 files）里带着
> `GitAdapter` / `ConsoleReporter` / `extractAllIdsByKind` / `falsifierRatchet` / `rules/index.js`
> 五个**早已无源**的模块；本次构建清干净后包降到 91 files（复现：`npm pack @chahuajia/collab-cli@0.5.1`
> 后看包内文件）。

## 三、0.6.0 里改了什么（release note 素材）

- **parse 的边界契约换了**（KB `ADR-0012`）：块边界从 `===== FILE:` 人为分隔符改成
  **条目自描述 frontmatter**（`---` … `---`），路径由 `type` + `id` **派生**。
  于是 AI 的原样输出（开场白 + 围栏 + 真条目 + 协议示例 + 合规说明表 + 追问）
  **不再整单拒收** —— 实测那份夹具现在原样粘贴即可落盘。
- **宽容 ≠ 静默**：被跳过的块、被纠正的路径、被跳过的重复块都走 WARNING
  （`collab parse` 打到 stderr；`collab_parse` 返回 `warnings` 数组）。
- **判据改成"有阻断级才失败"**（原来是"有 issue 就失败"）——只有一个合法块都没有才拒收。
- ⚠️ **行为变更（会咬人）**：`parse` 现在**丢 slug** —— 用 id 当文件名（`skills/S36.md`，
  而不是 `skills/S36-agent-workspace-boundaries.md`）；已存在的 slug 文件**不会**被判成
  replace（会新建一个）。ADR-0012 明说 slug 落盘后由人补。
- **`init` 不再让人去跑不存在的脚本**：`scripts/collab-validate.mjs` 只有
  `consumer + --kb` 才生成；kb profile 的输出与骨架 README 改成直接给
  `npx --yes @chahuajia/collab-cli@^<当前线> validate`（原来是三处指着一个没生成的文件）。
- **kb 骨架立刻可用**：以前工具链**认不出**它（布局 B 的标记是目录，而空目录进不了 git），
  `validate` / `new` / `catalog` / `index` / `fix` **五条命令全报"找不到工作区"**；
  现在骨架自带六个 kind 目录的空 `_index.md`，`init → new → index → catalog → validate`
  全程不必 `--dir`。
- **`new adr` 不再生成"过不了自己 validate"的条目**：ADR 曾套用模式语言的章节骨架
  （缺 背景 / 决策 / 后果 / 替代方案）；"产物通过 validate"那条测试也从只测 `skill`
  扩到**六种 kind 参数化**。
- **`fix` 修好两处会改坏文件的行为**：`aliases: []` 曾被补成**非法 YAML**（`[, id]`）；
  带 BOM 的文件曾被拒（`frontmatter not found`）、CRLF 文件会被静默改成 LF。
- **`--help` 不再列错 `--profile`**：原来写着早已不存在的 `starter`；现在从
  `SUPPORTED_PROFILES` **派生**，并由 `help.test.ts` 钉住。
- **安装范围不再手写**（本次新增）：`@^0.5` 曾**手写在四处**（kb 骨架 README、consumer
  wrapper、`init` 的两条提示）。升到 0.6.0 时它们会**同时**把用户钉回 0.5.x，而且不报错 ——
  `npx` 老老实实装旧包，用户拿到的是**换 parse 契约之前**的版本。现在统一从
  `package.json` 派生（`COLLAB_NPM_RANGE`），并由 `repo-hygiene.test.ts` 挡住再抄一遍。
- **两个 CI 都红着，修了**（本次新增）：`collab-cli` 与 `collaboration` 的 workflow 都写
  `cache: npm` + `npm ci`，而两个仓**只有 `pnpm-lock.yaml`** —— `actions/setup-node`
  在找锁文件那一步当场失败，后面的步骤全是 `skipped`。实测 GitHub API：
  2026-09-25 的 5 次运行 `conclusion = failure`。**本地 `npm run check` 全绿并不是 CI 绿。**
  现在两边都走 pnpm，且 CI 里把 KB checkout 过来，`COLLAB_REAL_KB` 一设，
  三条"要真库才跑"的测试从静默 skip 变成真跑。
  修的过程中又撞出第三处"承诺 vs 现实"：**锁文件本身也是陈旧的** —— `prettier` 早已从
  `package.json` 删掉，`pnpm-lock.yaml` 里还留着三处引用，于是 `pnpm install --frozen-lockfile`
  连本地都过不了。本次按删除项**外科式**同步锁文件（10 行），实测
  `pnpm install --frozen-lockfile` → "Lockfile is up to date"。
- **不再把作者的盘符发给你**（本次新增）：`enforcedTargets.ts` 曾把三个 `D:\actto\...`
  写成 `??` 的兜底，而 `dist/` 会打包 —— **实测已发布的 0.5.1 tgz 里就是那三个绝对路径**。
  现在三仓路径走 `src/infrastructure/fs/repoRoots.ts` 的**唯一一份**解析链
  （`COLLAB_CLI_DIR` / `COLLAB_KB_DIR` / `EVOLUTIONARY_DIR` → `COLLAB_PROJECTS_DIR` 或从包位置
  上溯 + 一处声明的相对布局 → 不可达就是"无法判定"）。**这是行为变更**：
  以前在别的机器上那三个默认值必然指空，现在同样指不空——但至少是你自己的布局说了算。
- **`check-freshness` 从 `working-memory/` 搬进 `scripts/`**（本次新增）：那是数据目录，
  而且 `.mjs` 在 `scripts/` 之外会同时逃出 `tsc` / `eslint` / `vitest`。现在入口是
  `npm run memory` / `memory:draft` / `memory:attest`（会话开始那一步）。
- **`validate --check-enforced` 不再"假装查过"**（本次新增）：目标**无法判定**时
  （仓名不认识 / 那个仓在本机不可达）原先静默放过 —— 于是"查过了没问题"和
  "根本没查成"在输出上一样。现在报 **`ENFORCED_UNCHECKED`（WARNING）**：
  退出码仍是 0（"无法判定 ≠ 不存在"是既有裁决，报 error 会让拿不到业务仓的机器全红、
  然后整条检查被关掉），但**你必须看得见**。
- **本仓文档也被 `--help` 检查了**（本次新增）：原先只有 KB 的文档有这条检查，
  本仓 `README.md`（**随 npm 包发布**）漏了 `retire --enforced` 必填的 `--confirm`，
  还指着一个已改名的文件（`assert-no-skips.mjs`）。现在
  `scripts/__tests__/cli-docs.test.ts` 扫 `README.md` / `AGENTS.md` / `RELEASE.md` /
  `scripts/README.md`，除"选项存在且用对命令"外多一条**成对规则**
  （写了 `--enforced` 就必须写 `--confirm`）；顺带修了检查器的盲区：
  `--dormant|--enforced` 这种并列写法原先**一个都不被识别**。
- **发布卫生**（本次新增）：补 `LICENSE`（MIT —— `package.json` 一直写着 MIT，
  而仓库里没有那个文件）；`.gitignore` 加上 `package-lock.json` / `npm-shrinkwrap.json`
  （两个锁文件就是"CI 装的和本地装的不一样"，本轮已经踩过一次）；
  `working-memory/reach-check.cjs` 搬进 `scripts/one-off/` 并把两个绝对路径改成必填参数
  （标本可以失效，但不该把某台机器的盘符带进公开仓）。

> 以上来自一次**最小可用性排查**（从装包到 MCP 逐条命令实跑）——
> 记录与命令见 `working-memory/tasks/minimal-usability-audit.md`。

## 四、发布后可以做的两件小事

1. ~~wrapper 默认值改回来~~ **已完成**（`1f1488b`）：生成物 `scripts/collab-validate.mjs` 里
   默认已是 `?? "npx --yes @chahuajia/collab-cli@^<当前线>"`；**2026-09-26 起这个 `^0.x`
   由 `package.json` 派生**（`COLLAB_NPM_RANGE`），不再手写。
2. `collab init` 的 `--with-ci` / `--with-hook` 可以改成默认开（现在要人显式给）。
3. ~~空 kb 骨架不能被 `validate` 自动识别~~ **已修（2026-09-26）**：kb profile 现在把六个 kind
   目录的 `_index.md` 写进计划（空目录进不了 git，所以"标记"必须是文件）。实测骨架
   `init → new → catalog → index → validate` 全程不带 `--dir` 通过。改检测规则
   （而不是补文件）属于基座变更，没做。

## 五、release note 必须带的一段（别省）

> **诚实边界**：这套东西里被证据支持的是**机制**（校验器 / 两账本 / 入库门槛 / 毕业退役），
> 不是条目内容。唯一干净的对照实验测出**零差异**，读库那一路墙钟 **+55%**。
> "读了有没有用"**至今不可判定**。
>
> **0.6.0 新增的边界**：`parse` 只认**带 frontmatter 的条目**（任意文件，如 `src/foo.ts`，
> 本来就不该走这条通道）。既没标记、也没外层围栏、后面又没跟下一个条目的**最后一块**，
> 其尾随散文与正文**无法区分** —— 工具不猜，由落盘后的人与 `validate` 兜底。
> 另：`collab init --profile kb` 曾造出一个"工具链认不出"的骨架（空目录进不了 git → 布局 B
> 的标记丢了），本版修掉：骨架自带六个 kind 目录的空 `_index.md`。
>
> **包里没有 `working-memory/` 与 `scripts/`**（见 `files`）—— 它们是**本仓的开发资产**。
> README 里提到的 `npm run memory*` 是 **checkout 里才有意义**的开发仪式（和 `npm test` 一样，
> 装了包的人在 `node_modules` 里跑它当然会失败）；使用者侧对应的产品能力是 **`collab memory`**，
> 检查的是**他们自己仓**的 `working-memory/`。

写不写这段，决定了这份 release 是技术说明还是宣传稿。

## 六、配套文章

`collaboration` 仓库的 `SHARE.md` ——《当生产免费，唯一稀缺的是判断》，
含"对 agent 的好处/坏处"各一节 + "什么值得推广、什么不值得"四层表。
