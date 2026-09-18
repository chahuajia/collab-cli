# 2026-09-18 collaboration 生态重构

**状态**：✅ 四阶段完成，四门禁全绿。改动留在工作区，**等人 commit**（AI 不 commit）。

## 做了什么

| 阶段 | 内容 |
| :--- | :--- |
| **P0 修基础设施** | 删 5 个 0 字节文件；真库测试去掉写死的 `entries: 113` 与硬路径，改断言不变量；新增 `npm run test:ci` 跳过门禁；修 `collab new adr` 生成非法 status；修 `AGREEMENT_LIMIT` 计数（此前计数不过滤 status，导致"归档腾位置"是空头支票）；`check-freshness` 接进 `.husky/pre-push` |
| **P0.5 消灭手写数字** | KB `README.md` 目录表、`meta/interceptions.md` 表头、`meta/known-gaps.md`、`collab-cli/README.md` 的可计算量全部删除或改为命令输出 |
| **P1 代谢出口** | 新增 `enforced` 字段（ADR-0011）；`collab retire` 命令；`isRouted()` 统一配额与路由表判据；迁移脚本补 121 条 `enforced: null` |
| **P2 首次毕业退役** | `patterns/domain-purity-is-structural` 标 `enforced` → 退出路由索引（121→120），文件与索引保留 |

## 四门禁（全绿）

```sh
cd <collab-cli> && npm run check          # 678 passed, exit 0
cd <collab-cli> && npm run test:ci        # 678 通过 · 0 跳过, exit 0
node <collab-cli>/working-memory/check-freshness.mjs   # exit 0
node <collab-cli>/dist/cli/index.js --dir <KB> validate  # 122 entries, 0 issues
```

## 途中发现并修掉的一个真 bug

`collab retire` 的 `setScalarField` 原按 `"\n"` 切分，而知识库在 Windows 上是 **CRLF**
（`core.autocrlf=true`）→ 每行带 `\r`，`lines[0] !== "---"` 永远成立 →
**命令不报错但什么也没改**。这正是本库一直在删的"假绿灯"。
已修（行尾归一化 + 写回还原原风格），并加回归测试 R9。

> 值得记的是：它失败的方式是**静默的**。如果当初 `--dry-run` 没打印出
> "没有可写的变化"，这个 bug 会以"退役了但没生效"的形态潜伏下去。

## 下一步（待人决定）

- [ ] 人 review + commit 两个仓（collab-cli、collaboration）
- [ ] 真正的 mark-and-sweep 可达性扫描（`known-gaps` 仍开着这条）——需要先裁决
      `pruning-policy` 的种子/边歧义：字面读法是空操作，反向读法会打出约 100 条
- [ ] `falsifier` 棘轮规则（当前只加了字段，未加 validate 规则）
- [ ] `templates/*.md` 与 `src/cli/lib/templates.ts` 的单一真相源（Phase 2 未做）
