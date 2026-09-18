# Spec: `collab apply`

**状态**：**已实现**（E1-E13 验收场景全部有测试且通过；4 个未决问题按建议默认值落地 —— 见 `progress.md`）
**作者**：codex（AI 提议）
**日期**：2026-09-16
**关联**：[[A10]] [[W8]] [[W9]] [[A7]] · 交接清单 §7

---

## 上下文

AI 产出条目是**成批**的（一次十几条），而知识库是**按条目存储**的。
现在这两者之间没有通道：AI 输出一段带 `===== FILE: <path> =====` 的文本，
人要手工切分、手工落盘。

上一次真实事故（2026-09-15）：

- 一次"落盘"产生了 **37 个文件，其中 35 个是 0 字节**；
- 唯一完整的来源反而是一份 79KB 的 bundle；
- 为了把 bundle 拆开，临时手写了一个 `extract-bundle.mjs`。

**结论**：缺的不是解析能力，是**一条可信的、可校验的落盘通道**。

## 目标

把 `bundle.json` 变成工作区里的文件，并且**要么全部成功，要么一个都不写**。

| # | 目标 | 可观察结果 |
| :--- | :--- | :--- |
| G1 | 落盘 | 文件出现，内容与 bundle 的 `sha256` 一致 |
| G2 | 拒绝坏输入 | 空内容 / 越界路径 / 冲突 → 整体失败且工作区不变 |
| G3 | 可审 | `--dry-run` 打印计划，不改任何文件 |
| G4 | 与现有命令一致 | 复用 `validate` / `index` / `commit` 的既有逻辑，不重写 |

## 非目标

- ❌ 解析 A17 文本协议（`===== FILE:`）→ 由后续的 `collab parse` 负责；
  本命令**只吃 JSON**。理由：解析与落盘是两种失败模式，混在一起无法定位。
- ❌ MsgPack / `pack` / `dump-bundle`（交接清单 P0-2/P0-3）—— 先证明 JSON 够用。
- ❌ 三方合并、自动解决冲突。
- ❌ 浏览器插件。

## 接口

```bash
collab apply <bundle.json> [--dry-run] [--index] [--commit] [--json]
```

| 选项 | 行为 |
| :--- | :--- |
| `--dry-run` | 只打印「将创建/覆盖/删除哪些文件」，不写盘 |
| `--index` | 落盘成功后刷新受影响的 `_index.md` |
| `--commit` | 落盘 + validate 通过后 commit（复用现有 commit 逻辑） |
| `--json` | 机器可读输出（供脚本/插件消费） |

### bundle.json（沿用交接清单 §7.1）

```json
{
  "version": 1,
  "generated_at": "2026-09-16T10:00:00Z",
  "generated_by": "AI",
  "base_commit": "1ae6a33",
  "files": [
    { "path": "skills/S36-xxx.md", "action": "create",
      "content": "---\nid: S36\n...", "sha256": "e3b0c442...", "base_sha256": null }
  ]
}
```

## 行为规格

### 1. 预检（全有或全无）—— 必须先全部通过，再写第一个字节

| 检查 | 失败时 |
| :--- | :--- |
| JSON 可解析、`version === 1`、`files` 非空 | 拒绝 |
| `path` 在允许目录内（`agreements/ workflows/ skills/ patterns/ meta/ domains/ inbox/`） | 拒绝 |
| `path` 不含 `..`、不是绝对路径 | 拒绝 |
| `path` 已剥掉 `COLLABORATION/` 前缀（AI 常带；带则自动剥） | 规范化后继续 |
| `content` **非空且非纯空白** | 拒绝（回归 35 空壳事故） |
| `sha256` 与 `content` 实际哈希一致 | 拒绝 |
| `action: create` 且目标已存在 | 拒绝（提示改用 replace） |
| `action: replace` 且目标不存在，或 `base_sha256` 与现值不符 | 拒绝 |
| `action: delete` 且目标不存在 | 拒绝 |

### 2. 落盘

按 `files` 顺序写入 / 覆盖 / 删除。写盘阶段**不再做校验**（预检已保证）。

### 3. 门禁

| 时机 | 行为 |
| :--- | :--- |
| 写盘后 | 自动跑一次 `validate` |
| validate 失败 | **不回滚**（文件已在盘上，git 可恢复），但退出码非 0 并列出失败条目 |
| `--index` | validate 通过后刷新 `_index.md` |
| `--commit` | index 之后 commit，message 默认 `chore(collab): apply <bundle 文件名>` |

## 验收（先写测试，再写实现）

| # | 场景 | 期望 |
| :--- | :--- | :--- |
| E1 | 3 个 create，全部合法 | 3 个文件出现，内容与 sha256 一致，exit 0 |
| E2 | 其中 1 个 `content` 为空 | **一个文件都不写**，exit ≠ 0，报出该文件 |
| E3 | 其中 1 个 `content` 只有空白行 | 同 E2 |
| E4 | `path` = `../evil.md` | 拒绝，工作区不变 |
| E5 | `path` = `agreements/../../evil.md` | 拒绝 |
| E6 | `path` = `COLLABORATION/skills/S36-x.md` | 自动剥前缀，写到 `skills/S36-x.md` |
| E7 | `action: create` 但文件已存在 | 拒绝，不覆盖 |
| E8 | `action: replace` 且 `base_sha256` 不匹配 | 拒绝，并提示"文件已被外部修改" |
| E9 | `action: replace` 且 `base_sha256` 匹配 | 覆盖成功 |
| E10 | `action: delete` | 文件被删除 |
| E11 | `--dry-run` | 打印计划，**文件系统无任何变化** |
| E12 | 落盘后 validate 失败（如死链） | 文件保留，exit ≠ 0，报告失败原因 |
| E13 | `sha256` 与 content 不符 | 拒绝（bundle 被篡改/损坏） |

> E2/E3 是本命令存在的**首要理由**：它们是上次事故的回归测试。

## 反面

- 不要"边校验边写"——第 3 个文件失败时前 2 个已经在盘上，用户要手工收拾。
- 不要让 `apply` 自己解析 `===== FILE:` 文本——解析错误与落盘错误会混在一起。
- 不要在 `apply` 里重写 validate / index / commit 的逻辑——复用，否则规则会出现两份。
- 不要默认 commit —— AI 不 commit、不 push（[[A7]]）；`--commit` 由人显式给出。
- 不要把"validate 失败"当成"回滚"的理由——git 已经保证可恢复，回滚反而更难审。

## 未决问题（需要人拍板）

> 落地时（2026-09-16）**按下列建议默认值实施**，待用户确认或纠正。

1. **写盘后 validate 失败要不要回滚？** → 不回滚。**已落地**。
2. **`--commit` 默认值**：建议默认关闭，必须显式传。**已落地**。
3. **是否允许 `apply` 写 `inbox/`**：建议允许（bundle 可先归档到 inbox）。**已落地**（白名单含 `inbox/`）。
4. **`base_commit` 要不要强制校验**：建议第一版**只记录、不阻塞**（阻塞会造成"必须 rebase 才能落盘"的摩擦）。**已落地**。

### 落地时新增的第 5 个决策：门禁的规则集

**落盘门禁用 `contentRules`（内容规则），不用 `standardRules`（含索引规则）。**

理由：新建条目**还没进 `_index.md`**。若门禁跑全量 validate，
`checkIndexForward` / `checkIndexExists` 会让"每一次新建落盘"都失败 ——
E1 的"3 个 create → exit 0"就无法成立，`--index` 也失去意义。

分工因此是：

| 阶段 | 规则集 | 把关什么 |
| :--- | :--- | :--- |
| 落盘后门禁 | `contentRules` | 条目本身合法（类型 / 目录 / 章节 / 链接） |
| `--index` | 复用 `collab index` | 把新条目登记进 `_index.md` |
| `--commit` | `standardRules`（全量） | 索引一致性也在内 —— 没登记就提交不了 |

见 anchors："产物必须通过 `collab validate`（无 index 相关规则）"。

## 关联

[[A7]] [[A10]] [[W8]] [[W9]] · `working-memory/tasks/collab-apply/`
