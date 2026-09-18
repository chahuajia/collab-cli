# 2026-09-18 `enforced` 机制审计：它站得住吗？

**结论**：站得住。8 条拦截里 **3 条够格毕业**（不是 1 条），机制不是为特例造的。
但审计暴露了**两个真缺陷**，都长在我自己新加的机制上。

## 一、逐个核对（账本 8 条 → 产物）

| 条目 | 产物 | 够格？ |
| :--- | :--- | :--- |
| `domain-purity-is-structural` ×2 | `architecture/DomainFrameworkFreeTest` —— 扫 `domain/`+`application/`，禁 Spring/JPA/Hibernate import | ✅ 已毕业 |
| `S13-Smart-Constructor` | `station/domain/StationTest.emptyCannotSwap` —— `Station.create` 可建空站，`swap` 抛 `NoAvailableBatteryException` | ✅ 已毕业 |
| `S34` ×2 | 7 个 `*ApiErrorTranslator` + `SwapApiErrorTranslatorTest`（`UnknownStationException`→404）、`EntitledSwapControllerTest`（→422） | ✅ 已毕业 |
| `dependency-decision` | **无产物** —— 没有任何测试约束 pom 依赖 | ❌ 不入 |
| `frontend-ddd-rsc` | **无产物** —— 前端零测试，eslint 只有 `next/core-web-vitals` | ❌ 不入 |
| `policy-without-mechanism` | 元规则，本身不是可固化对象 | ❌ 不入 |

**3/8**。足以证明机制不是特例 —— 但也说明它**不是自动的**：
剩下 3 条要靠人判断"这两条其实是被别的机制防住的"（`dependency-decision` 靠人 review，
`frontend-ddd-rsc` 靠还没有的测试），这正是设计意图（人审确认）。

## 二、审计暴露的两个真缺陷（都在我新加的机制上）

### 缺陷 1：`enforced` 路径可以随便写，没有验证

我第一次写毕业时，把路径写成
`com/evolutionary/DomainFrameworkFreeTest.java` —— **该文件不存在**
（真实位置在 `architecture/` 子目录）。`validate` 报 **0 issue**。

**后果**：条目**静默地**退出路由索引，而它声称的固化**根本不存在** —— 知识真的丢了。
这是本项目一直在删的那类假象（假绿灯、编造的数字），长在了新机制上。

现在：3 条路径我手工逐个 `ls` 验证过。**但没有规则会持续保证这件事。**

### 缺陷 2：毕业了，但路由面没跟着更新 —— 而这没人检查

毕业只改 `catalog.json`（agent 路由表），**不改 `AGENTS.md` 的症状表**。
于是 `AGENTS.md` 里两行还在说"读 S13"/"读 S34" —— 而 S13/S34 已不在 catalog 里。
`domains/architecture/_index.md` 同样。

**注意**：`_index.md` 保留毕业条目是**对的**（索引 ≠ 路由表）。
错的是**症状表** —— 它是 KB 的第一路由面，指向一条已经不需要读的条目，
就是在收"读了没用"的税。

我是靠手工 grep 发现的。**没有任何规则会抓它。**

## 三、已修（2026-09-18 当晚）

### 修 1：`enforced` 路径可验证

- `collab retire --enforced`：写入前查**形态**（`<repo>:<path>`）+ **存在性**
  （按仓名解析根目录；未知仓名只查形态并明确告知）。实测拦住了我犯过的那个错。
- validate 加 `ENFORCED_SHAPE_INVALID` 规则（只查语法，保持密闭）。
- **分工**：存在性归 CLI（它有 IO，在写入那一刻查最有效）；validate 只查形态。

### 修 2：路由面一致性规则

- 新增 `ROUTING_TO_GRADUATED`：症状表/域索引的**表格行**指向已毕业条目、
  且未标注「已毕业」→ 报。
- 关键判据：**只查表格行**。路由的本质是**映射**（"遇到 X → 读 Y"），
  而 `## 关联` 区那串平铺双链是**关联**不是路由 —— 毕业后仍该保留。
  实测踩到过这个假阳性。

### 修 2 的修：规则第一版漏掉了自己存在的理由

`ROUTING_TO_GRADUATED` 第一版只比对 **id**（`S13`），而症状表实际写的是
**文件名形式**（`[[S13-Smart-Constructor]]`）—— 于是它**漏报了**，
却因为单元测试用的是 id 形式而全绿。

修法：改用 `refersToIdentity`（`resolvesRef.ts` 里**全项目唯一的引用匹配规则**）。
教训与本仓 `S34` 同构：**自己再写一份匹配逻辑 = 第二个 bug 源**。
已加回归测试（文件名形式 + 关联区不报）。

### 附带修：`test:ci` 失败时不点名

一次偶发失败（疑似 E2E 超时抖动）只打印"测试未通过"，看不出是哪条。
现在 `assert-no-skips.mjs` 会**点名**失败的测试、文件、断言消息 ——
"哪条挂了"和"根本没跑"必须可分，这与该脚本要治的病同源。

### 修 3：入库门槛机制化（`FALSIFIER_REQUIRED`）

`falsifier` 字段加了却没人消费 —— 正是 `policy-without-mechanism` 说的
"字段是活的、语义是空的"。现在：**2026-09-19 起入库的条目必须有 falsifier**。

这条规则**我写错了两次**，两次都是同一个病：

| 版本 | 错法 | 为什么错 |
| :--- | :--- | :--- |
| v1 | 全库计数基线（"缺的不超过 115"） | **在任何小于基线的工作区里都是死的** —— 全部测试 fixture、fork、新仓。一个只在作者本机生效的规则不是机制，是环境耦合 |
| v2 | 对"创建"即生效 | `collab new` 造的是 **draft 空骨架**，那一刻"不读它会错什么"根本答不出 —— 强行要求只会逼出编造。13 个 "new → index → validate" 链路测试当场失败 |

定稿：**日期截止**（存量豁免）+ **只在入库时**（`draft`/`proposed` 豁免）。
实测三态：`collab new` 造 draft → 绿；升 active 不填 → 红；填了 → 绿。

> 两次错法有一个共同点：**门槛被放到了还无法回答它的时刻**。
> 第一次是放到了错误的工作区，第二次是放到了错误的生命周期。

已写 3 条有账本证据的 falsifier（`dependency-decision` / `frontend-ddd-rsc` /
`policy-without-mechanism`）—— **从账本转写，不编造**。其余 115 条留给 W5 慢慢补。

### 修 4：标记-清除落地（`known-gaps` 最后一条旧账关闭）

`pruning-policy` 说了很久的"标记-清除"，第一次有了可执行产物：
`collab retire --candidates`（`domain/entry/reachability.ts`）。

**裁决了种子/边歧义** —— 原政策字面读法（`_index.md` 也算种子）是**空操作**。
实测三种读法（`working-memory/reach-check.cjs`，可重跑）：

| 读法 | 扫出 |
| :--- | :--- |
| A：`_index.md` 也作种子 | **0 条** ← 空操作 |
| B：种子=根文档，**无向** | 1 条 |
| C：种子=根文档，**有向** | 24 条（混着明显活着的条目） |

采用 B。宁可少报（人再审一遍，可控），不要多报（被淹没后就不看了）。

**又是同一个 bug 模式。** 第一版把 `isRouted` 过滤放在**建图之前** →
已毕业的 `S13` 不在图上 → `S20/S24/S25/S28`（都指向它）成了悬空边 →
被误报成孤岛。**5 条候选里 4 条是假阳性。**

修法：**建图用全部条目，`isRouted` 只过滤候选输出**。
退出路由索引 ≠ 从图上消失 —— 毕业的条目文件仍在、仍可链接、仍是活的引用目标。
修正后候选从 5 条降到 **1 条**。

**真逃跑**：`catalyst-nodes` 退役 —— 入度 0 出度 0 的真孤岛，
且正文示例把它把 `A1` 列为杠杆条目，而 `A1` 已在 ADR-0008 删除。

> 这一轮我连着写错了 3 条规则（routingToGraduated 漏文件名形式、
> falsifier 门槛错位两次、reachability 假阳性）。
> **四次错法有一个共同点：把判据放在了错误的地方** ——
> 错误的引用形式、错误的工作区、错误的生命周期、错误的图构建顺序。
> 每次都是"拿真库跑一遍"才发现的，没有一次是单元测试发现的。

## 四、下一步（按价值排序）

1. **`enforced` 路径存在性检查** —— `collab retire --enforced` 写入前查（CLI 有 IO）；
   validate 只查语法（保持密闭）。这能拦住缺陷 1。
2. **路由面一致性规则** —— 症状表/域索引里指向"已毕业"条目的行必须显式标注，
   否则报 `ROUTING_TO_GRADUATED`。这能拦住缺陷 2。
3. **falsifier 棘轮**（上一轮遗留）。
4. mark-and-sweep 的种子/边歧义裁决（`known-gaps` 唯一旧账）。

> 1 和 2 都符合本库自己的判据（`patterns/policy-without-mechanism` 三问）：
> 违反能否 ≤60s 被外部观察？能。发现后有强制动作？有（写入被拒 / validate 红）。
> 执行面具备？具备（CLI 有 fs，规则有 RuleContext）。
