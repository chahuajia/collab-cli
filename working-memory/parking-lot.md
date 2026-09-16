## 未决策项

- [ ] **`collab edit` / `collab deprecate` 等新命令** —— 等验证 5 命令足够
- [ ] **`--dir` 参数** —— YAGNI，等真实需求
- [ ] **`scripts/add-author.mjs` / `add-dates.mjs` 是否合并成"通用迁移工具"** —— 等第三次迁移需求
- [ ] **`scripts/` TS 化 + 分层** —— 方向已定，等实施
- [ ] **`apply` 是否要求 `.md` 后缀** —— spec 未规定，第一版不强制；等出现非 `.md` 写入需求
- [ ] **`base_commit` 是否强制校验（rebase 门禁）** —— 第一版只记录不阻塞；等多人并发落盘的真实痛感
- [ ] **新行用哪种引用形态**：`index` 新行渲染 `[[S36]]`，真库用的是 `[[S36-slug]]` —— 两种都合法（`refersToIdentity` 都认），但混排不好看。改哪种需要拍板
- [ ] **`patterns/_index.md` 只列了 12/41 条** —— `collab index` 会补 29 行（只填 ID 列）。是补齐，还是 patterns 索引本来就该保持精选？

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
