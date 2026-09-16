# Working Memory

**更新**：2026-09-16 23:55

## ⚠️ 先跑这个，否则别信下面的"活跃任务"

```powershell
node check-freshness.mjs
```

**登记（本版）**：

| 仓库 | 登记 HEAD |
| :--- | :--- |
| `collab-cli` | `84a849b` |
| `collaboration` | `9729913` |
| `evolutionary` | `5e0122b` |

> evolutionary / collaboration 工作区脏，HEAD 未变（未 commit）。

## 活跃任务

| 任务 | 状态 | 文件 |
| :--- | :--- | :--- |
| **evolutionary 压测** | 🔄 第 7 轮 JPA/H2 完成 | `evolutionary/specs/round-7-report.md` |

## 第 4–7 轮

| 轮 | 结果 |
| :--- | :--- |
| 4 | 领域 Station/Swap；S13 拦截 |
| 5 | 应用层；**不**引 Spring；状态机专条不建 |
| 6 | 三问后**引入** Spring REST；架构测试钉领域纯净；interceptions **3** |
| 7 | 三问后**引入** JPA+H2；`StationJpaEntity` 映射；domain-purity 再拦；interceptions **4**；35 测绿 |

## 下一轮候选

前端 Next.js · 或收口 commit（AI 不擅自做）

## 陷阱

AI 不 commit/push；agreements 满；不开 A/B
