# 发布检查单（最小可用版）

> **2026-09-25 改名**：`collab-cli` 在 npm 上**已被他人占用**
> （`yisang09 10`，1.6.1，2026-06 发布）——所以发布报的 "already 1.6.1" 不是 tag 问题，是重名。
> 现用作用域名 **`@chahuajia/collab-cli`**（自己的作用域，冲突面为零）。
>
> **已发布**：`0.5.0` / `0.5.1`（`npm view @chahuajia/collab-cli versions` 可查）。**本次目标：`0.5.2`（未发布）**。

## 一、发布（两条命令）

```bash
npm version 0.5.2        # package.json 现在是 0.5.1
npm publish --access public   # 作用域包必须显式 public
```

> 为什么还是 `0.5.x` 而不是 `1.0.0`：核心命令稳定、747 测试全绿，
> 但**还没有第二个真实使用者**。"1.0" 是承诺，现在给不出。

## 二、发布前已验证（2026-09-26）

| 项 | 结果 |
| :--- | :--- |
| 测试 | **747 / 747** · 52 files |
| 类型 | `tsc --noEmit` 干净 |
| Lint | `eslint src` **0 error**（5 条 magic-number warning 为既有） |
| 打包 | `npm pack` → **98 files / 109 kB**（unpacked 329.6 kB） |
| 包内容 | `dist/**/*.test.js` **0** · `.map` **0** · `.d.ts` **0** · `bin/collab.js` 就位 |
| 装机 | 干净目录装 tgz → `--version` 通过；`init` 两个 profile 均实测 |
| 自举 | 对真实 KB 跑 `validate` → **129 entries / 0 issues** |

## 三、0.5.2 里改了什么（release note 素材）

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
  `npx --yes @chahuajia/collab-cli@^0.5 validate --dir .`（原来是三处指着一个没生成的文件）。

## 四、发布后可以做的两件小事

1. ~~wrapper 默认值改回来~~ **已完成**（`1f1488b`）：生成物 `scripts/collab-validate.mjs` 里
   默认已是 `?? "npx --yes @chahuajia/collab-cli@^0.5"`。
2. `collab init` 的 `--with-ci` / `--with-hook` 可以改成默认开（现在要人显式给）。
3. **空 kb 骨架不能被 `validate` 自动识别**（layout B 靠条目目录认人）：`init --profile kb`
   之后必须 `--dir .`，或先落第一条条目。要么让 kb profile 也建出条目目录 + `_index.md`，
   要么接受"先落第一条"——**这是 `tasks/collab-init/spec.md` 的未决项，别在本文件里悄悄定。**

## 五、release note 必须带的一段（别省）

> **诚实边界**：这套东西里被证据支持的是**机制**（校验器 / 两账本 / 入库门槛 / 毕业退役），
> 不是条目内容。唯一干净的对照实验测出**零差异**，读库那一路墙钟 **+55%**。
> "读了有没有用"**至今不可判定**。
>
> **0.5.2 新增的边界**：`parse` 只认**带 frontmatter 的条目**（任意文件，如 `src/foo.ts`，
> 本来就不该走这条通道）。既没标记、也没外层围栏、后面又没跟下一个条目的**最后一块**，
> 其尾随散文与正文**无法区分** —— 工具不猜，由落盘后的人与 `validate` 兜底。
> 另：`collab init --profile kb` 造出的空骨架**不能被 `validate` 自动识别**（layout B 靠
> 条目目录认人），要显式 `--dir .`；加了第一条条目后自然就好。

写不写这段，决定了这份 release 是技术说明还是宣传稿。

## 六、配套文章

`collaboration` 仓库的 `SHARE.md` ——《当生产免费，唯一稀缺的是判断》，
含"对 agent 的好处/坏处"各一节 + "什么值得推广、什么不值得"四层表。
