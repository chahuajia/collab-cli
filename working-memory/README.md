# Working Memory

**更新**：2026-09-17 00:12

## ⚠️ 先跑这个，否则别信下面的"活跃任务"

```powershell
node check-freshness.mjs
```

**登记（本版）**：

| 仓库 | 登记 HEAD |
| :--- | :--- |
| `collab-cli` | `ea35e84` |
| `collaboration` | `0225e23` |
| `evolutionary` | `944c67f` |

> evolutionary / collaboration / collab-cli WM 工作区脏（第 8–9 轮未 commit）。

## 活跃任务

| 任务 | 状态 | 文件 |
| :--- | :--- | :--- |
| **evolutionary 压测** | 🔄 第 9 轮 rewrite/BFF 完成 | `evolutionary/specs/round-9-report.md` |

## 第 4–9 轮

| 轮 | 结果 |
| :--- | :--- |
| 4–7 | 领域→应用→Spring→JPA；interceptions **4**；已 commit `944c67f` |
| 8 | Next.js；CORS/GET/种子；拦截 +0；**未 commit** |
| 9 | rewrite 同域 `/api`；活验 200/409；拦截 +0；**未 commit** |

## 下一轮候选

第 8–9 轮收口 commit · GraphQL（再跑三问）· 回 CLI（AI 不擅自 push）

## 陷阱

AI 不 push；agreements 满；不开 A/B
