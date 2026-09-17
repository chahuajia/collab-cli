# Anchors: CLI Development

**更新**：2026-09-17 09:26

## 不可遗忘的约束

1. **A10**：规格 → 测试 → 实现 → Review。
2. **domain** 不 import 第三方 / application。
3. **基座变更** = ADR + 迁移 + validate 归零。
4. **规则一份**；生成物由生成侧刷新。
5. **AI 不 commit、不 push**。

## 当前阶段

11 命令已落地。cli-audit 与候选队列本轮已收口。

## 下一个动作

**长运行 A4**（见 `loop.md`）：commit 锚点规则 → 评估 `_index` 迁移 → 真 CI。

链接锚点已定 id；不要空转；不要批量填 trigger；不要 push。
