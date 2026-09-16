## 未决策项

- [ ] **`collab edit` / `collab deprecate` 等新命令** —— 等验证 5 命令足够
- [ ] **`--dir` 参数** —— YAGNI，等真实需求
- [ ] **`scripts/add-author.mjs` / `add-dates.mjs` 是否合并成"通用迁移工具"** —— 等第三次迁移需求
- [ ] **`scripts/` TS 化 + 分层** —— 方向已定，等实施
- [ ] **`apply` 是否要求 `.md` 后缀** —— spec 未规定，第一版不强制；等出现非 `.md` 写入需求
- [ ] **`base_commit` 是否强制校验（rebase 门禁）** —— 第一版只记录不阻塞；等多人并发落盘的真实痛感
- [ ] **新行用哪种引用形态**：`index` 新行渲染 `[[S36]]`，真库用的是 `[[S36-slug]]` —— 两种都合法（`refersToIdentity` 都认），但混排不好看。改哪种需要拍板
- [ ] **`patterns/_index.md` 只列了 12/41 条** —— `collab index` 会补 29 行（只填 ID 列）。是补齐，还是 patterns 索引本来就该保持精选？

### 2026-09-16 五份外部评估提出的结构性改造（全部需要拍板）

> 这些是**约定级 / 结构级**变更，按 A10 需双方确认；我不擅自执行。

- [ ] **拆"协议层"与"手册层"**（最重要）：`agreements/` 应接近恒定（≤10 条、跨栈通用），`skills/`+`patterns/` 才是可自由增删的手册。现在协议承担了手册的增长 → 宪法被稀释成备忘录
- [x] ~~**第一次真正的"选择"事件**：把 A10 / W8 / S27 / `review-marginal-value` 四条（320 行）合并成 1 条~~ —— **2026-09-16 已完成**（见 ADR-0005、`evolution-log` v4.2.0）
- [ ] **降层**：A18 → `meta/`（它是术语表）、A19 → `workflows/`（它是流程）、A14 → `meta/`
- [ ] **归档"0 人社群的治理"**：A7 / W6 / W7 / S10 / S11 / ADR-0002 / ADR-0004 + 4 个社区模式 + `rfcs/` `profiles/` `.github/CODEOWNERS`（引用了不存在的 `@core-team`）
- [ ] **`domains/` 的 6 个 `_index.md` 空壳**：按"今天有消费者吗"判据应删；但它是"按技术领域找入口"的落点，需要你定
- [ ] **语义 id**：`patterns/` 已做对（`rooted-graph`）；A/W/S 数字编号是"位置编号"，两 fork 分叉后不可杂交 —— 是否把语义 id 作为真名、编号降为别名？
- [ ] **`assumes` / `last-verified` 字段**：把 pruning 从"6 个月"时间驱动改成"模型/工具换代"事件驱动
- [ ] **`patterns/dual-expression-for-human-and-system` 缺家**：两份独立评估都称它是全库最有原创性的一条，但全库没有这个文件（只在 `inbox/README.md` 一行里被提到）
- [ ] **顺序之争**：五份文件对"项目 → 工具 → 文章"还是"文章先行"不一致。我的裁决建议：**项目 > 文章 > 工具**（没有真实拦截记录，文章就是第 107 个条目）

### 2026-09-16 用户已拍板的搬迁（链接规则已就位，可以安全执行）

> 顺序理由：搬家会**改文件名** → 所有引用都要重写。所以链接规则必须先落地（已完成），再搬。

- [ ] **`A7-distribution-and-community` → `integrations/`**（需给 collab-cli 加 `integration` 这个 kind + 目录）
  - ⚠️ 但 A7 有两半：**AI 写权限边界**（`不 commit / 不 push`，今天就在用）与**社区治理**（Layer2/3、RFC、2 人批准、许可证，0 人社区）。
    建议只把前一半搬成 `integrations/cli-agent/`，后一半归档 —— 需要你确认是否同意拆
- [ ] **`A17-对话式AI输出格式约定` → `integrations/`**（明确的"对话式适配层"，无争议）
- [ ] **`A1-output-format` → 合并进 `skills/S1-h2-output`**（两者是同一件事，不是搬家而是合并）
- [x] ~~`agreements/` 收到 ≤10 条~~ —— **第一批已完成**（19→15：A2/A8/A9 并入、A5 删除，见 ADR-0006）

#### 剩余条目的处置（第二批进行中）

| 结论 | 条目 |
| :--- | :--- |
- [x] `A15`/`A17` → `integrations/`（chatgpt-paste-protocol / chatgpt-output-format）**已完成**
- [x] `A7` → 拆出 `integrations/cli-agent-boundaries`，社区治理归档 **已完成**
- [x] `A16` 改前提 **已完成**
- [x] 全部完成 —— **约定层收敛为 8 条**（见 ADR-0008）

#### 接下来（五篇文章里"还没做"的部分）

- [x] ~~代谢律变成脚本~~ —— **已完成**：`collab new agreement` 在 ≥10 时拒绝（无 `--force`）
- [x] ~~dormant = 退出路由索引~~ —— **已完成**：`buildCatalog` 过滤 dormant/deprecated
- [ ] **拦截账本真实记账** —— 目前 0 条真实记录（只有样例）
- [ ] **`catalog.json`**（id / type / trigger / anti-trigger / 一句话）—— 把 `O(n)` 降低到 `O(log n)`
- [ ] **语义 id** 推广到 A/W/S（`patterns/` 已做对）
- [ ] ⚠️ **链接锚点形式**：`[[S12]]`（序号前缀）还是 `[[S12-边界解析]]`（完整文件名）——
  后者改名即断链，与"id 不可变"矛盾。见 `ADR-0009` 的未决段。**这是下一轮的第一优先**
- [ ] `catalog.json` 里补 `trigger` / `anti-trigger` / `一句话` 三个字段（现在只有 id/type/status/title/path/domains/appliesTo）
- [x] ~~`extractLinks` 不跳过代码块/代码片段~~ —— **已修**（围栏 + 行内代码都跳过）
- [x] ~~`CATALOG_STALE` 进 validate~~ —— **已完成**（在真库上当场抓到 catalog 已过期）
- [x] ~~`apply` 之后 catalog 必过期~~ —— **已修**：`apply` 落盘后自动刷新 `catalog.json`（`--dry-run` 不写）
- [ ] **机械字段的自动修复命令**：现在只有 `collab new` 会写 `aliases`；
  存量文件如果缺，只能靠 `ID_NOT_IN_ALIASES` 报错后人工补。要不要一个 `collab fix`？
- [ ] **冻结基座**：写死目录结构 / frontmatter 字段 / id 语法，并规定"基座变更 = 破坏性变更 + 迁移脚本"
- [ ] **UTF-8 BOM 问题**排查（文章 #7，我没验证过）
- [ ] **真 CI**（现在的假 CI 已删）—— 等 collab-cli 可分发

> 全部执行后 `agreements/` = **8 条**：`A3 A4 A6 A10 A12 A13 A14 A16`。
> 技术前置：`integrations/` 要成为可校验目录，得给 collab-cli 加 `integration` 这个 kind。

### 合并类改动的操作规程（本次跑通，下次拆协议/手册直接照做）

顺序不能换 —— 第 2 步是保险，第 8 步是验收：

1. 读四条全文，列出**逐字重复的段落**（这是"该合并"的证据，不是印象）
2. `rg` 数引用面：`[[长名]]` / `[[短id]]` / **裸引用**（`applies-to: [W8]`）/ 模板 / 索引（漏一处就死链）
3. 写合并条目，**保留被引用最多的那个 id 与文件名**
4. 删掉其余文件
5. 改引用：>10 处 → 用 Node 脚本（S29/S30），脚本用完即删
6. 人工改**入口与索引**（`AGENTS.md` / `README.md` / `_index.md` 的表格外内容）
7. 去重：合并会让 `[[A10]] [[W8]]` 变成 `[[A10]] [[A10]]`，要专门清一遍
8. `collab validate` —— **死链 0 就是本次改动的验收标准**
9. 写 ADR + `evolution-log`（A10 规定约定级变更必须写 ADR）
10. 更新工作记忆

**踩过的坑**：`aliases` 字段**不被 validator 使用**（`resolvesRef` 只看 id 与文件名）——
所以旧编号放进 `aliases` 只方便人检索，**不能指望 `[[W8]]` 自动解析**，引用必须真改。

## 未触发项

- [ ] **`split-collab.mjs` 内容划分修复** —— 等用户明确具体错误
- [ ] **v4.1 bundle 拆分** —— 依赖 split 脚本修复
- [ ] **MCP Server 实现** —— 等 collab-cli 完成 + 真实 MCP 场景
- [ ] **批次 1（测试重构）恢复** —— 用户决定挂起
- [ ] **`writeSkill` 路径约定统一**（接受相对或绝对）—— 等误用再次出现
- [ ] **MsgPack / `pack` / `dump-bundle`**（交接清单 P0-2/P0-3）—— 先证明 JSON 够用
- [ ] **`apply` 的 validate 失败回滚** —— 已决定"不回滚"（git 可恢复）；等反例

## 已处理

- ✅ `add-author.mjs` 的目录范围 bug
- ✅ `collab index` 用文件名当 id 的 bug
- ✅ ADR status 校验
- ✅ `created` / `updated` 字段迁移
- ✅ lint 4 errors → 0
- ✅ 批次 2 四任务
