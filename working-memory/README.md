# Working Memory

**更新**：2026-09-19 00:22

## ⚠️ 先跑这个

```powershell
node working-memory/check-freshness.mjs
```

判据是**时间**：上面那行 `**更新**：` 必须晚于三个仓最后一次产品代码提交。
改这行**不会**让检查通过 —— 产品代码的时间戳是固定的，你骗不了它。

> **这里不再抄 HEAD 哈希。** 抄写是第二份真相源，必然漂移 ——
> 上一版接上电后拦的第一次 push，就是因为它写的还是旧哈希。
> 当前 HEAD 由脚本**算出来打印**（见 `patterns/derivation-over-copy`）。
>
> 已接 `.husky/pre-push`。仓库路径可用 `COLLAB_CLI_DIR` / `COLLAB_KB_DIR` /
> `EVOLUTIONARY_DIR` 覆盖；**路径不可达是硬失败，不是跳过**。
> `collab-cli` 自身的比较**排除 `working-memory/`** —— 否则"更新本文件"
> 会让它自己过期，永远收敛不了。

## 活跃任务

| 任务 | 状态 | 文件 |
| :--- | :--- | :--- |
| **KB 生态重构（P0–P2）** | ✅ 四门禁绿 · 已 commit；freshness 判据改时间 | `tasks/2026-09-18-kb-restructure.md` |
| **`enforced` 机制审计** | ✅ 3/8 够格毕业；2 个缺陷已修；入库门槛已机制化 | `tasks/2026-09-18-enforced-audit.md` |
| **待提交**：`FALSIFIER_REQUIRED` 规则 | ⏳ 工作区（4 改 2 新） | — |
| **collab-pressure** | ✅ round 1–17 | `tasks/collab-pressure/loop.md` |
| **collab-pressure-extreme** | ✅ 已停（idle 3 · v4.8.7） | `tasks/collab-pressure-extreme/loop.md` |
| **evo-collab-extreme** | ⏸ 已暂停（用户 19:17） | `tasks/evo-collab-extreme/loop.md` |
| CLI A4 | ✅ 收口 | `tasks/cli-development/loop.md` |

> **evolutionary 侧**（`303dc35`，22:51）：先前那批 127 个未提交改动已提交，
> 工作区已清空；最新一笔是"将独立的枚举类合并到对应的领域类内部"
> （承接 `working-memory/decisions.md` 的 enum 重构）。wave41 已 merge。

## 测量

> **不在这里写数字** —— 本节曾写"validate 119/0 · trigger 50/50"，
> 而实际早已是 122/0。手写的可计算量必然腐烂，而且会污染认真读者的判断
> （`meta/interceptions.md` 表头那个错数骗过了四个人）。
> 要数字就跑命令：

```sh
node <collab-cli>/dist/cli/index.js --dir <KB> validate   # 条目总数 + 一致性
node <collab-cli>/dist/cli/index.js --dir <KB> catalog    # → catalog.json（含 byType/byStatus）
grep -c "^| 2026-" <KB>/meta/interceptions.md             # 拦截条数
```

KB 的验证状态由 KB 自己的 CI 保证；本文件只登记 HEAD，不做第二份真相源。

## 陷阱

AI 不 push；merge `version/v0` / topic 须确认。
`.husky/pre-push` 现在会跑 `check-freshness` —— **commit 后必须更新上面的登记表**，
否则 push 会被拦下（这是设计，不是故障）。
