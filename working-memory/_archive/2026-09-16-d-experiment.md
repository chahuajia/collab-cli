# Archive: D 实验（2026-09-16）

> **归档文件，永不修改**（W10）。阶段：**对照实验 D ——「读了到底有没有用」**。

## 结果

| 项 | 结论 |
| :--- | :--- |
| r1 | 不入判据（基线回声） |
| r2 | 不入判据（处理未施加） |
| **r3** | **入判据**：装置干净；M5 仍无差异（累计六跑全同） |
| 动作 | **停止 A/B**；**不砍** A10 / design-decision / domain-purity |
| 收口 | **修入口**：`collaboration/AGENTS.md` 加 3 行工程症状 |

## 关键事实

- 六跑 M5 全把不变量放在聚合根；模型自己就会。
- 臂 B 按路径检索后报「状态机 / 不变量放哪一层」库无专条 → 缺口去 `known-gaps`，不是砍条目。
- 路由通了（改 brief 后入口会被用）；该修的是症状表覆盖。

## 证据路径

- `evolutionary_start/_experiment/round-3-r3.md`
- `working-memory/tasks/d-experiment/`（收口后的进度，可继续改）
- `collaboration/AGENTS.md`（症状表）· `meta/known-gaps.md`（第一行「入口已修，待独立命中」）
