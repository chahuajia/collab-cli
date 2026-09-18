# CLI 长运行循环

**更新**：2026-09-17 09:52 ｜ **tick**：4 完成 ｜ **循环**：已停（3s 积压 wake）

## tick 4 摘要

| 交付 | 结果 |
| :--- | :--- |
| `collaboration/.github/workflows/validate.yml` | checkout 双仓 + `collab validate` |
| 3s loop `752390` | 已杀（tick 3 后积压 ~30+ wake，无新工作） |

## A4 收口

| 项 | 状态 |
| :--- | :--- |
| 链接锚点 + 迁移 | ✅ |
| collab-cli CI | ✅ |
| collaboration validate CI | ✅ workflow 已写 |
| patterns 索引 | ✅ |

## 恢复循环

用户指定间隔后再 arm；**不要**无工作空转 3s。

## 停止

「停止长运行」= 不 arm wake（当前已停）。
