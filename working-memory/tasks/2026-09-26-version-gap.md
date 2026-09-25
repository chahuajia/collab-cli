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

## 裁决（2026-09-26 傍晚）：**用 0.6.0**

按 semver：
- 有 breaking → **0.6.0** ← **采用**
- ~~或保守取 0.5.2，但在 CHANGELOG 点明 parse 契约变更~~

理由：`parse` 的边界契约是**对外接口**（粘贴协议），用 `0.5.2` 会让同一个号指两种行为。
`package.json` 已改为 `0.6.0`；发布动作仍归人（见 `RELEASE.md`）。

### 裁决时**顺带撞出来**的连锁缺陷（已修）

| 缺陷 | 为什么它比版本号更危险 |
| :--- | :--- |
| **安装范围四处手写 `@^0.5`** —— kb 骨架 README / consumer wrapper / `init` 的两条提示 | 升 0.6.0 时四处**同时**把用户钉回 0.5.x，而且**不报错**（`npx` 照装旧包，用户拿到换契约前的版本）。已改为从 `package.json` 派生 `COLLAB_NPM_RANGE`，并由 `repo-hygiene.test.ts` 挡住再抄一遍 |
| **`pnpm-lock.yaml` 陈旧**（`prettier` 已从 `package.json` 删除、锁文件还在） | `pnpm install --frozen-lockfile` 直接失败 —— 这是 CI 装依赖的那一步。已外科式同步（删 10 行） |
| **两个 CI 从没跑起来**（`npm ci` + pnpm 锁文件） | 见 `2026-09-26-ci-never-ran.md` |

### 仍需人确认（**本次未核**）

1. `npm view` 上的 `0.5.1` 与 tag `v0.5.1` 内容一致（上一版就没核，这次仍未核）
2. parse 的 WARNING 通道（`ParseSkippedBlock`）在文档里有说明 ——
   它改变的是"宽容 ≠ 静默"的对外承诺

> 这条记在 WM 而不是 KB：它是**本仓的发布流程问题**，
> 不是跨项目的长期知识（见 [[W10-working-memory]]）。
