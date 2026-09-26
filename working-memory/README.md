# Working Memory

**更新**：2026-09-26 7:59  

## ⚠️ 先跑这个

```powershell
npm run memory
```

判据是**增量**（2026-09-25 起）：`.attested.json` 记着"上次对账到哪些 HEAD"，
之后只看 `HEAD..HEAD` 里有几个**产品提交** —— 报的是"自上次对账以来 3 个提交"，
不是"你过期了"。**没有 `.attested.json` 时**才回退到第一代的**时间**判据（上面那行
是否晚于各仓最后一次产品提交）。
签名写法：`**更新**：YYYY-MM-DD HH:MM`（小时一位数也行、冒号全角半角都行 ——
机器侧一律规范化成两位；2026-09-26 之前要求 `\d{2}`，人手写 `7:59` 会被判"找不到时间戳"）。

> **这一行只能人写，不要脚本自动刷新。** 自动刷新 = 永远通过 = 这个检查就死了 ——
> 而那正是本仓删过两次的"假绿灯"（`echo TODO` 的 CI、写死 `entries: 113` 的测试）。
> 它是"有人真的看过这份记忆"的**唯一凭据**；必须可能是假的，否则它就不是凭据。

接在**会话开始**（`AGENTS.md` 第一步），**不在 pre-push** —— 新鲜度是"读者进场"的属性，
不是"写者推送"的属性。三仓路径的解析链在 `src/infrastructure/fs/repoRoots.ts`：
`COLLAB_CLI_DIR` / `COLLAB_KB_DIR` / `EVOLUTIONARY_DIR`（或整体换根 `COLLAB_PROJECTS_DIR`）
可覆盖，**不可达是硬失败不是跳过**。
另两个入口：`npm run memory:draft`（只读，看变了什么）、`npm run memory:attest`（人签完再记）。
`collab-cli` 自身比较时**排除 `working-memory/`** —— 否则"更新本文件"会让它自己过期。

## 本文件的边界

**只写"在做什么、为什么"。不写可计算的事实。**

计数、HEAD、提交状态、文件数 —— 这些都有命令能算出（`git status` /
`collab validate` / `collab catalog`），手抄进来必然腐烂，而且会污染认真读者的判断。
本文件历史上烂过两次：`测量` 栏写 119/0 而实际 122/0；
`活跃任务` 栏写「待提交：FALSIFIER_REQUIRED ⏳ 4 改 2 新」而那批早已 commit。

> 同类教训另见 KB 的 `meta/interceptions.md`：它的表头写"当前条数 7"而表里 8 行，
> **骗过了四个读者**（其中一个是专门去审计它的）。

## 活跃任务

> **对齐于 2026-09-26 傍晚**（只写判断，不写数字）：自上次声明后 ——
> evolutionary 的"视图化"线仍在停（HEAD 两次核对未动）；
> KB 侧做了**两次检查**：第一次把顶层三篇并成 `SHARE.md`、修掉全线腐烂的手写数字、
> 记下缺口「散文里的断言机器验不了」；第二次（傍晚）审了 `pruning-policy` 的
> **机制成熟度**（14 条主张里 **5 条 ✅ 有机制、1 条靠人、8 条从未执行**）、
> 补上 README 缺的主干地址 / `LICENSE` / 目录表，并把 `CODEOWNERS` 里三个**不存在的团队**
> 换成真人。
> **工具链侧**：发布版本改判 `0.6.0`（parse 契约是 breaking）；
> **两个 CI 从"从未跑起来"修成 pnpm**（根因是 `npm ci` 找不到锁文件 —— 见下）。
> **具体提交数与 HEAD 请看 `npm run memory` 的输出 —— 不抄进这里。**

| 任务 | 状态 | 文件 |
| :--- | :--- | :--- |
| **KB 生态重构（P0–P2）** | ✅ 收口 | `tasks/2026-09-18-kb-restructure.md` |
| **`enforced` 机制审计** | ✅ 收口 | `tasks/2026-09-18-enforced-audit.md` |
| **接手 evolutionary 实测 KB** | ✅ 收口（视图化线已停；证据见 evo WM） | `../evolutionary_start/evolutionary/working-memory/HANDOVER.md` |
| **L3 停摆复盘（09-20）** | ⚠️ 结论已落，**"零增量"仪器仍未接线** | `../evolutionary_start/evolutionary/working-memory/next-direction.md` §八 |
| **collab-pressure / -extreme** | ✅ 已停 | `tasks/collab-pressure/loop.md` |
| **evo-collab-extreme** | ⏸ 暂停（09-20 复盘见 evo WM） | `tasks/evo-collab-extreme/loop.md` |
| **CLI A4** | ✅ 收口 | `tasks/cli-development/loop.md` |
| **`collab init`（脚手架）** | 📋 规格待拍板（D1 已收敛为"单一调用点"） | `tasks/collab-init/spec.md` |
| **KB 对外分享** | 📄 `SHARE.md`（分享稿）+ `CORE.md`（技术内核） | KB 顶层 |
| **2026-09-26 会话（parse 契约 + 可用性排查 + DDD 整理）** | 🚧 改动全在工作区；**未提交、未发布** | `tasks/2026-09-26-session-handoff.md`（会话级，含未完成清单） |
| **发布 0.6.0（版本 / 安装范围派生 / 锁文件）** | 🚧 待发布；`package.json` 已是 `0.6.0` | `tasks/2026-09-26-version-gap.md` + `RELEASE.md` |
| **两个 CI 从没跑起来（红）→ 改 pnpm + 真库接线** | 🚧 已修，**真正的绿灯要等下次 push 才知**（本地跑不了 GH Actions） | `tasks/2026-09-26-ci-never-ran.md` |
| **KB 修剪政策的机制审计 + 全库冲突清扫** | ✅ 已落（KB `v4.13.2`） | KB `meta/pruning-policy.md` 的「机制成熟度」表 |
| **`check-freshness` 搬家 + 三仓路径去硬编码** | ✅ 已落；入口变 `npm run memory`（⚠️ 时间戳仍待人签） | `scripts/check-freshness.ts` · `scripts/lib/freshness.ts` · `src/infrastructure/fs/repoRoots.ts` |
| **本仓文档↔`--help` 检查 + 发布卫生** | ✅ 已落（README 的 `--confirm` 缺失、`assert-no-skips.ts` 改名、MIT LICENSE、npm 锁文件护栏） | `scripts/__tests__/cli-docs.test.ts` · `README.md` · `LICENSE` · `.gitignore` |
| **`--check-enforced` 不再静默** | ✅ 已落：无法判定 → `ENFORCED_UNCHECKED`（WARNING，仍 exit 0） | `src/cli/commands/validate.ts` · `src/domain/validation/Issue.ts` |
| **全库检查（散文断言 / 三篇并一）** | ✅ 已落；缺口记 KB `known-gaps` | KB `meta/known-gaps.md` 末行 |

> **evolutionary 侧**：wave41 已 merge；enum 重构已提交。
> 那批积压的 127 个未提交改动已清空。

> **表格更新说明（2026-09-26 傍晚）**：加入了三行（发布 0.6.0 / 两个 CI / KB 机制审计）；
> **`更新：` 那一行我没有动** —— 按本文件自己的规则，
> 它是"有人真的看过这份记忆"的**唯一凭据**，只能人写。
> 于是本文件**现在仍是红灯**（`check-freshness` 自 09-26 起报漂移）。
> **这是设计的正确状态，不是故障**：机器给了事实，签名等人。

## 陷阱

- **AI 不 push**；merge `version/v0` / topic 须用户明确确认。
- **先改 git，再刷新登记** —— 勿空登记。
- **双轴勿混**：`version × phase` 分开 commit / 分记 WM，勿互相顶替。
- **计数 / HEAD / 文件数一律现算**（`git log`、`collab validate`），不抄进任何文档 —— 手抄必然腐烂。
- **新鲜度自检已不在 pre-push**（2026-09-25 移走）：现在接在**会话开始**，见仓库根 `AGENTS.md`。
  挂在 pre-push 上拦的是写者，受害的却是下一个读者；三仓都在活动时它会每两分钟红一次，
  红灯变噪音 → 只能靠顺手乱签压下去。**红灯的响应协议见根 AGENTS.md。**


## 仓职责（跨仓分工）

> 从 `working-memory/AGENTS.md` 并入（2026-09-25）。那份文件已降级为指针 ——
> **本地状态只在本文件**，两份副本必然漂移。

| 仓 | 角色 | 不该塞什么 |
| :--- | :--- | :--- |
| **collab-cli** | 工具链 / 门禁 / MCP / validate | 业务领域实现 |
| **evolutionary** | 业务实现 + 项目级 WM（**真相仓**） | CLI 协议细节 |
| **collaboration** | 协作知识库本体（长期知识） | 项目轮次日记 |
| **aggregate 根 / shared 根** | 跨仓指针 | 当第二工作区 |
