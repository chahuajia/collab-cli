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
- [ ] **第一次真正的"选择"事件**：把 A10 / W8 / S27 / `review-marginal-value` 四条（320 行）合并成 1 条 —— 三份评估都点名这是"讲同一件事"
- [ ] **降层**：A18 → `meta/`（它是术语表）、A19 → `workflows/`（它是流程）、A14 → `meta/`
- [ ] **归档"0 人社群的治理"**：A7 / W6 / W7 / S10 / S11 / ADR-0002 / ADR-0004 + 4 个社区模式 + `rfcs/` `profiles/` `.github/CODEOWNERS`（引用了不存在的 `@core-team`）
- [ ] **`domains/` 的 6 个 `_index.md` 空壳**：按"今天有消费者吗"判据应删；但它是"按技术领域找入口"的落点，需要你定
- [ ] **语义 id**：`patterns/` 已做对（`rooted-graph`）；A/W/S 数字编号是"位置编号"，两 fork 分叉后不可杂交 —— 是否把语义 id 作为真名、编号降为别名？
- [ ] **`assumes` / `last-verified` 字段**：把 pruning 从"6 个月"时间驱动改成"模型/工具换代"事件驱动
- [ ] **`patterns/dual-expression-for-human-and-system` 缺家**：两份独立评估都称它是全库最有原创性的一条，但全库没有这个文件（只在 `inbox/README.md` 一行里被提到）
- [ ] **顺序之争**：五份文件对"项目 → 工具 → 文章"还是"文章先行"不一致。我的裁决建议：**项目 > 文章 > 工具**（没有真实拦截记录，文章就是第 107 个条目）

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
