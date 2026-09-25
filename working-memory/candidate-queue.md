# 候选队列

> 达阈值后归并沉淀。触发：队列 ≥ 5 / 任一 ≥ 7 天 / 3 个相关 / 用户要求。

## 本轮已处理（2026-09-26）

| 候选 | 处置 |
| :--- | :--- |
| 回归夹具放在**仓外**（`D:\下载缓存\test.txt` 当验收标准） | → **已在库** `patterns/reproducible-verification` → 直接修：夹具入仓 + 新建 `.gitattributes`（`-text`）+ 两条测试；KB `meta/interceptions.md` 记一行 |
| 发布检查单里的数必须是"命令 + 此刻输出" | → **已在库** `patterns/delete-beats-automate` → 标吸收；`RELEASE.md` 已按实测重写（顺带抓出 `init` 三处假承诺） |
| brief 里的**文件路径**是断言，不是判据 | → **留队列**（见下） |
| **文档面手写的取值/清单必然漂移**（最小可用性排查抓到 3 例：help 的 `--profile starter`、kb AGENTS.md 指 `working-memory/`、KB 症状表漏 `--reason`） | → **已在库** `patterns/delete-beats-automate`（"该不该在 → 能不能派生 → 才轮到生成器"）→ 标吸收；已按"派生"修掉其中能派生的那处（help 从 `SUPPORTED_PROFILES` 派生 + `help.test.ts` 钉住）。**没有新建条目**：这是既有判据的第 N 次显形，不是新判据 |

## 本轮已处理（2026-09-17 15:30）

| 候选 | 处置 |
| :--- | :--- |
| project-evidence-vs-kb-ledger | → **新建** `patterns/project-evidence-vs-kb-ledger`；改 interceptions / known-gaps / evolution-log-format |
| agent-workspace-boundaries | → **新建** `S36`；evolutionary `working-memory/agents/{fe,be}/` |
| pattern-id-alignment | → **改** `meta/naming-conventions`（模式语义 id + 建议 `P-*` alias；不批量重命名） |

代谢：新增 2 条 + 改既有账本范围（等价「处理」淹没风险）；未强制 dormant。

## 本轮已处理（2026-09-16 23:30）

| 候选 | 处置 |
| :--- | :--- |
| higher-order-factory | **已在库**（`patterns/higher-order-factory`）→ 标吸收 |
| L1/L4 动态深度 | **已在** `W11` §「L1 深度和 L4 轮数都按任务动态决定」→ 标吸收 |
| 派生优于复制（队内旁注） | **已在** `patterns/derivation-over-copy` → 标吸收 |
| how-as-injected-function | → **新建** `patterns/how-as-injected-function` |
| rule-set-layering | → **新建** `patterns/rule-set-as-subset` |
| merge-procedure | → **新建** `W12-条目合并`（parking-lot 规程迁入） |

代谢：新增 3 → 处理 1：`patterns/rfc-process` → **dormant**（与 W7 重叠 ≥50%）。

## 当前队列

| 候选 | 出处 | 备注 |
| :--- | :--- | :--- |
| brief 里的具体断言要能证伪 —— "改哪个文件"是猜测，"跑哪条命令"才是判据 | 2026-09-26 parse ADR-0012：交接文档让改 `src/domain/parse/parseCollabText.ts`，而 domain 不许 import YAML；真正定音的是 `npm run lint` 的分层规则 | 与 `patterns/reproducible-verification`（"规则的前提必须能被验证"）**可能重叠**，未判定 —— 凑够 3 个相关或挂满 7 天再裁（候选挂着不是推进，见 `check-freshness` 的提醒） |
