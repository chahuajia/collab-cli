# AGENTS.md

> 本文件是 **AI 进入本仓的入口**。人类读者看 `README.md`。
> 原则：**入口指向，不复制内容。**

## 会话开始：先跑这一步（**不是可选**）

```bash
node working-memory/check-freshness.mjs
```

它回答一个问题：**这份工作记忆，还配得上被信任吗？**

| 结果 | 你要做什么 |
| :--- | :--- |
| `ok 工作记忆新鲜` | 继续下一步 |
| 报 `自上次对账以来 N 个产品提交` | 跑 `--draft` 看变了什么 → 改 `working-memory/README.md` 的「活跃任务」栏 → **亲手**改头部 `**更新**：` 的时间 → 跑 `--attest` |

**为什么接在会话开始，而不是 pre-push**：新鲜度是"读者进场"的属性，不是"写者推送"的属性。
挂在 pre-push 上拦的是写者，受害的却是下一个读者；而且三仓都在活动时，它会每两分钟红一次，
红灯变噪音，最后只能靠顺手乱签压下去 —— 那正是本仓删过两次的假绿灯。

**那行时间戳只能人签。** 它是"有人真的看过这份记忆"的唯一凭据；机器签 = 凭据作废。

## 然后

1. 读 `working-memory/README.md`（当前在做什么、为什么 —— **只写判断，不写可计算的事实**）
2. 真相仓的交接：`..\..\evolutionary_start\evolutionary\working-memory\HANDOVER.md`
3. 协作知识库（长期知识）：`D:\actto\front\project\collaboration_aggregate\collaboration`

## 边界

- **AI 不 push**；本地 commit 可以；合并到 `version/v0` 等须用户确认。
- 「继续」≠ 自动 merge / push。
- 计数、HEAD、文件数这类**可计算的事实一律现算**（`git log` / `collab validate`），
  不抄进任何文档 —— 手抄必然腐烂。