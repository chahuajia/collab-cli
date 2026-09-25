# 版本号与发布面脱节（2026-09-26 检查发现）

## 事实（已核实）

| 项 | 值 |
| :--- | :--- |
| `package.json` version | **0.5.1** |
| npm 上的版本 | **0.5.1**（已发布） |
| tag `v0.5.1` 指向 | `12e67c6` |
| 当前 HEAD | `9660e0f` |
| tag 之后的提交数 | **11** |

其中两条重要：
- `feat(parse)!` —— **breaking change**（ADR-0012：条目边界改用自描述 frontmatter）
- `feat(cli): 添加 push 命令` —— 新功能

## 问题

**breaking change 与新增功能落在已发布的 0.5.1 上，版本号没有动。**

下次发布时，`0.5.1` 这个号会同时指两种不同的 parse 契约 ——
而 parse 契约是**对外接口**（粘贴协议）。

## 待办（**需人决定，AI 不发布**）

按 semver：
- 有 breaking → **0.6.0**
- 或保守取 **0.5.2**，但在 CHANGELOG 点明 parse 契约变更

无论选哪个，**发布前应确认**：
1. `npm view` 的 0.5.1 与 tag `v0.5.1` 内容一致（本次未核）
2. parse 的 WARNING 通道（`ParseSkippedBlock`）在文档里有说明 ——
   它改变的是"宽容 ≠ 静默"的对外承诺

> 这条记在 WM 而不是 KB：它是**本仓的发布流程问题**，
> 不是跨项目的长期知识（见 [[W10-working-memory]]）。
