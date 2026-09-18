## 未决策项

- [ ] **`collab edit` / `collab deprecate` 等新命令** —— 等验证现有命令足够
- [ ] **`scripts/add-author.mjs` / `add-dates.mjs` 是否合并成"通用迁移工具"** —— 等第三次迁移需求
- [ ] **`scripts/` TS 化 + 分层** —— 方向已定，等实施
- [ ] **`apply` 是否要求 `.md` 后缀** —— 等出现非 `.md` 写入需求
- [ ] **`base_commit` 是否强制校验（rebase 门禁）** —— 等多人并发落盘的真实痛感
- [ ] **新行用哪种引用形态**：`index` 新行 `[[S36]]` vs 真库 `[[S36-slug]]` —— 需拍板
- [ ] **`patterns/_index.md` 精选 vs 全量** —— `collab index` 会补空白行；需拍板

### 需拍板（约定 / 结构）

- [ ] **语义 id** 推广到 A/W/S（`patterns/` 已做对）
- [x] ~~**链接锚点形式**~~ —— **已定 id**（ADR-0009 + `INDEX_REF_PREFER_ID` 警告）；真库 65 行待迁移
- [ ] **`assumes` / `last-verified` 字段**（pruning 事件驱动）
- [ ] **`domains/` 空壳 `_index.md`** 删还是留
- [ ] **归档 0 人社群治理残留**（W6/W7 社区向、`rfcs/`、`profiles/`、CODEOWNERS）
- [ ] **`patterns/dual-expression-for-human-and-system` 缺家** —— 评估称原创，但文件不存在
- [x] ~~**真 CI（collab-cli）**~~ —— `.github/workflows/ci.yml`：PR + push + `npm run check`
- [x] ~~**真 CI（collaboration validate）**~~ —— `.github/workflows/validate.yml`（双仓 checkout + collab validate）
- [x] ~~**拦截账本真实记账**~~ —— **已有 5 条**（S13 · dependency-decision · domain-purity ×2 · S34）；继续在真实使用中追加，不编

### 已结清（2026-09-16）

- [x] 拆协议层 / 手册层；约定 19→8；集成层；A7/A15/A17 搬迁；A1→S1
- [x] A18→`meta/terminology`；A19→`W11`（配额棘轮已删）
- [x] `collab fix`；冻结基座 `base-contract`；BOM 排查（0 个带 BOM）
- [x] `CATALOG_STALE`；`apply` 自刷 catalog；`extractLinks` 跳过代码
- [x] MCP Server（双协议、无 commit/push 工具）
- [x] D6 旧脚本删除；cli-audit F1–F8
- [x] 候选队列归并 → how-as-injected / rule-set-as-subset / W12；rfc-process dormant
- [x] `--dir` 已实现（CLI + MCP）
- [x] v4.1 bundle 拆分 —— **取消**（`split-collab` 已删，能力在 `parse`）

## 未触发项

- [ ] **批次 1（测试重构）恢复** —— 用户挂起
- [ ] **`writeSkill` 路径约定统一** —— 等误用再次出现
- [ ] **MsgPack / `pack` / `dump-bundle`** —— 先证明 JSON 够用
- [ ] **`apply` 的 validate 失败回滚** —— 已决定不回滚；等反例

## 已处理（历史）

- ✅ `add-author.mjs` 目录范围 · `collab index` 引用规则 · ADR status · 日期迁移 · lint · 批次 2
