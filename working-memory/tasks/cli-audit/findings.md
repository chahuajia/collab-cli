# CLI 重审（collab-cli）

**更新**：2026-09-16 ｜ **执行者**：主 agent（子 agent 投递失败，见文末）

> 范围：`collab` 的十个命令 + 新增的 `collab mcp`。方法：读代码 + 跑命令取证。
> 每条都给**可复现的证据**，不给印象。

## 结论摘要

**CLI 的核心循环是"最小可用且正确"的**：`parse → apply → index → validate` 闭合，
`apply` 的"全有或全无"有预检保证，MCP 层双协议握手实测可用、stdout 纯净。
但**周边有三处会咬人的地方**：`npm run dev` 等 4 个 script 指向不存在的文件、
7 个幽灵暂存条目会让一次 commit 复活死文件、`fix --dry-run` 的退出码与真实运行不一致
（dry-run 因此不能当验收用）。另有一类**文档承诺与行为不符**（退出码 2 从不出现、
`--json` 的适用范围写窄了），以及 12 个一次性脚本仍留在 `scripts/` 里充当第二份真相源。

## 缺陷表

| 编号 | 严重度 | 位置 | 证据 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| F1 | ~~major~~ **已修** | `package.json` scripts | `scripts.dev = "tsx src/bin/collab.ts"`；`Test-Path src/bin` → **False** | `npm run dev` 必然失败。`script:add-author` / `script:add-dates` / `script:migrate-write-entry` 同样指向不存在的 `.ts`（只有 `.mjs` 存在）—— **4 个 script 全是死的**。已改为指向真实入口 |
| F2 | **major** | git 索引 | `git status --porcelain` → 7 条 `AD`：`src/cil/**`×6 + `indexConsistency.test.ts` | 文件在盘上已不存在，但**已暂存"新增"**。一次 commit 会把这些死文件写回仓库 |
| F3 | minor | `src/cli/commands/fix.ts:75` | `if (unfixable.length > 0 && !dryRun) process.exit(1)` | 同一份输入，`--dry-run` 退 0、真实运行退 1 ⇒ **dry-run 不能当验收**。与 `new --dry-run` 那次教训同源：dry-run 的退出码必须与真实运行一致，否则它只是预览 |
| F4 | minor | `validate.ts` 文档头 / CLI 入口 | 文档写"退出码 2：参数错误"；实测 `collab nope` → **1**、`collab parse`（缺参数）→ **1** | 且命令普遍用 `parseArgs({strict:false})`，**未知选项被静默忽略**。这个"2"从未出现过 |
| F5 | minor | `--help` | help 写 ``--json  Machine-readable output (for validate)``；`apply.ts` 也有 `--json` | 适用范围写窄了，且两者 JSON 形状不同（`validate` 是 issues 报告，`apply` 是 status+operations） |
| F6 | minor | `--help` | `--dry-run` 在 "Command options" 出现两次（一次归 new/apply，一次归 push）；`new`/`fix` 的 `--dry-run` 未列入 | 同一个开关四种语义，读者无法判断"哪些命令支持" |
| F7 | nit | `--help` | ``parse <source.txt\|->        Parse A17 text``（少一格，与上下行不对齐） | 纯排版 |
| F8 | minor | `scripts/` | 12 个脚本，其中 `extract-bundle.mjs` / `split-collab.mjs` / `recover.mjs` / `collab-audit{,2}.mjs` / `when.mjs` 是历史遗留 | `extract-bundle.mjs` 正是 `collab parse` 落地后该删的（spec D6，已挂 4 轮）。**每个仍在仓库里的旧通道都是一份会漂移的真相源** |

## 详细分析

### F1 四个 script 指向不存在的文件

`package.json` 里有 4 处指向磁盘上不存在的路径：

```
scripts.dev            = tsx src/bin/collab.ts          → src/bin/ 不存在
scripts.script:add-author        = tsx scripts/add-author.ts        → 只有 .mjs
scripts.script:add-dates         = tsx scripts/add-dates.ts         → 只有 .mjs
scripts.script:migrate-write-entry = tsx scripts/migrate-write-entry.ts → 只有 .mjs
```

它们不阻塞 `check`（测试不跑这些 script），所以**一直是绿的**。
这正是"没人跑的命令会腐烂"的形态：不是写错了，是**没人核对**。
最小修复：`dev` 指向 `src/cli/index.ts`，三个 `script:*` 改成 `.mjs` 或直接删除。

### F2 幽灵暂存条目

`src/cil/`（`cli` 的旧拼写）在某个时点被改名，但改名前的**新增**还留在索引里，
形成 7 条 `AD`（staged add + 工作区删除）。后果不是"多几个文件"，
而是**提交时会把不存在的命名空间复活**——与之前 `ADR` 残留那把火同源。
最小修复：`git rm --cached` 这 7 条。

### F3 dry-run 的退出码

`--dry-run` 的价值是"跑一遍但不写"。若它的退出码与真实运行不同，
它就不能被放进流水线当验收——**能当验收的东西，必须与真实运行同判**。
当前 `fix --dry-run` 在"有不可修复项"时仍退 0。

### F4–F7 文档承诺与行为不符

四处的共同点：**文档写了一个行为，代码不做**。这类漂移只有机器会发现，
而目前没有机器在读 `--help`。建议加一条测试：把 `collab --help` 的输出与
`COMMANDS` 表对照（命令名集合必须一致）——低成本、能永久防漂移。

## 已验证为**正确**的部分

不只报坏消息 —— 下面这些是实际跑过的：

| 项 | 证据 |
| :--- | :--- |
| MCP 现代协议 | `server/discover` 6 请求 → 5 应答（1 条是通知），**坏行 0** |
| MCP 旧协议 | `initialize` 回显 `2025-06-18`，且结果**不带** `resultType` |
| MCP 规则靠"缺失"执行 | `tools/call collab_push` → `-32602 unknown tool`（工具表里根本没有） |
| stdout 纯净 | `rg "console\.(log\|error)" src/mcp src/cli/commands/mcp.ts` → 只命中注释 |
| 真库经 MCP 校验 | `collab_validate` → **106 entries / 0 errors / 0 warnings** |
| 全量门禁 | `npm run check` → **595 tests / 43 files 绿**，lint 0 error |

## 未能验证的项

- **UNVERIFIED**：Codex 真正拉起这个 MCP 服务器时的进程级行为（我只验证了协议层与手工 spawn，
  没有在 Codex 会话内实际调用过工具）。注册项本身已确认：`codex mcp get collab` → enabled。
- **UNVERIFIED**：`--json` 在各失败路径下是否覆盖全部状态值（`apply.ts` 有 4 个 status，
  测试覆盖了主要路径，未逐条枚举）。
- **UNVERIFIED**：Windows 路径大小写/长路径在极端目录下的行为。

## 建议下一步

1. **F1 + F2**（约 5 分钟，纯机械）—— 死 script 与幽灵条目都属于"一次 commit 就会出事"
2. **F3**：让 `--dry-run` 与真实运行同判
3. **加一条 help 一致性测试**（命令集合 / 选项集合对照 `COMMANDS` 表）—— 把 F4–F7 这类漂移变成机器能抓的
4. **D6 落地**：删 `extract-bundle.mjs` 等旧脚本
5. 真 CI：仍按用户裁决放后面

## 附：本次子 agent 投递失败

本轮尝试把"重审"拆成 CLI / 知识库两半交给两个子 agent 并行执行。
**两次投递（初次任务 + followup）都没有到达**：两个 agent 的回报均为
"没有收到任务"，并在两次轮次间给出**完全相同**的工作区状态描述（`545 tests`、
`src/cil` 的 `AD` 条目），说明它们看到的是**同一个陈旧快照**，而非新任务。
主 agent 随后自己完成了 CLI 这一半。
