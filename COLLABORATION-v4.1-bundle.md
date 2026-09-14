## 一、约定 Agreements

### 修改：A10 补充 Spike 前置阶段

**未来文件路径**：`COLLABORATION/agreements/A10-review-上移原则.md`

在 A10 的"五阶段流程"前，**插入 Spike 阶段**：
### 五阶段 + Spike

当问题空间不明确（无法直接写出测试）时，在"规格"之前插入 Spike。

    Spike（可选） → 规格 → 测试 → 实现 → Review → 完成

**Spike 规则**：
- 目标：学习，不是生产。
- Timebox：默认 2 小时。
- 代码：不保留（故意扔掉）。
- 产出：写入规格的知识。
- 判定：能不能在"不写任何实现代码"的情况下明确写出测试？能 → 跳过 Spike；不能 → 先 Spike。

**关联**：[[A8]] [[W9]]

### 新增：A11 值同不代表语义同
**未来文件路径**：`COLLABORATION/agreements/A11-值同不代表语义同.md`
---
id: A11
type: agreement
status: active
created: 2026-09-13
updated: 2026-09-13
applies-to: [all]
supersedes: null
author: <待填>
---

# A11 值同不代表语义同

## 上下文

同一个值（如 `0`、空字符串、`null`）在不同业务上下文中，其含义完全不同。

## 问题

- 跨域共享"通用值"（如全局 `MathConstants.Zero`）会摧毁语义系统。
- 一旦有人改了共享常量，影响面不可控。
- 阅读时无法判断"这个 0 在业务上是什么"。

## 方案

- **值相同不代表语义相同**。当同一个值在不同上下文有不同业务含义时，必须在各自的领域**重新定义常量**。
- 禁止跨域共享"通用值"。
- 常量名必须能读出业务语义（如 `Severity.Error` 而非 `'error'`）。

## 反面

- 不要为了"避免重复"而把不同语义的同值常量合并。
- 不要用数字/字符串字面量表达业务含义。
- 不要用"通用的 0/1/-1"替代语义常量。

## 关联

[[A8]] [[S5]] [[S17]]

## 二、工作流 Workflows
### 新增：W8 规格优先的 AI 协作流程

**未来文件路径**：`COLLABORATION/workflows/W8-规格优先的-AI-协作流程.md`
---
id: W8
type: workflow
status: active
created: 2026-09-13
updated: 2026-09-13
domains: [meta]
applies-to: [A10]
supersedes: null
author: <待填>
---

# W8 规格优先的 AI 协作流程

## 上下文

AI 让"实现"成本趋近于零，但人的 review 带宽没变。按"AI 写完 → 用户读代码"的方式协作，review 会变瓶颈。

## 问题

- 输出量大，用户凭直觉扫代码。
- 实现错误与需求错误混在一起。
- 用户逐渐失去对系统的理解。

## 方案

### 核心原则（承接 A10）

**Review 对象优先级**：规格 > 测试 > 类型 > 实现。

### 五阶段流程

    Spike（可选） → 规格 → Review → 测试 → Review → 实现 → Review → 完成

- 上游产出物必须先 review 通过，才进入下游。
- 下游失败可回退到上游，而非在下游修补。

### 五个对策

| 陷阱 | 对策 |
| :--- | :--- |
| 测试代码也会爆炸 | 按行为分组、表驱动、`toMatchInlineSnapshot`；review 名字而非每个 `expect` |
| 测试和实现"同错" | 规格先于测试；测试必须包含反面案例 |
| 迭代不收敛 | 每轮定义收敛目标；最小可验证增量；Timebox |
| 小瀑布风险 | 循环足够小（一次一个行为）、可中断 |
| 探索任务不适用 | 区分"清晰任务"与"探索任务" |

### Review 的本质

**用户 review 的是"意图"，不是"代码"。** 测试是意图的一种形式化表达，不是唯一形式。

## 反面

- 不要把探索任务塞进此流程。
- 不要用"AI 说它对"替代"我理解它对"。
- 不要让流程僵化。

## 关联

[[A10]] [[W9]] [[patterns/review-marginal-value]]

### 新增：W9 Spike 工作流
**未来文件路径**：`COLLABORATION/workflows/W9-Spike-工作流.md`
---
id: W9
type: workflow
status: active
created: 2026-09-13
updated: 2026-09-13
domains: [meta]
applies-to: [A10]
supersedes: null
author: <待填>
---

# W9 Spike 工作流

## 上下文

当"要做什么"本身都不清楚时，TDD 无法启动——写不出测试，因为不知道期望什么。

## 问题

- 强行 TDD 会写出"我以为是这样的"测试 → TDD 失真。
- 实现出来的东西不是用户要的。

## 方案

### 触发条件

**能不能在"不写任何实现代码"的情况下明确写出测试？** 不能 → 先 Spike。

### Spike 六步

1. **定义目标**：Spike 要回答的 3-5 个具体问题。
2. **Timebox**：默认 2 小时。
3. **写实验代码**：写在 `spike/` 或临时目录。
4. **记录发现**：把每个问题的答案写下来。
5. **扔掉代码**：Spike 代码不合并。
6. **写入规格**：发现变成规格的一部分，进入正式 A10 流程。

### Spike 报告结构

- **目标**：要回答的问题清单
- **Timebox**：约定时长
- **发现**：每个问题的答案
- **结论**：可行 / 不可行 / 需调整方向
- **下一步**：进入规格或重新定义问题

## 反面

- 不要把 Spike 当"原型开发"——Spike 是学习，不是造产品。
- 不要让 Spike 无时间上限。
- 不要为了"不浪费代码"而保留 Spike 产物。

## 关联

[[A10]] [[W8]] [[patterns/spike-as-scaffolding]]
## 三、技能 Skills
以下 19 条技能，按依赖顺序排列。每条格式紧凑，但保留"上下文/问题/方案/反面/关联"五段。
### S12 边界解析

**未来文件路径**：`COLLABORATION/skills/S12-边界解析.md`
---
id: S12
type: skill
status: active
created: 2026-09-13
updated: 2026-09-13
domains: [architecture, typescript]
applies-to: [W3]
supersedes: null
author: <待填>
---

# S12 边界解析（Parse, don't validate）

## 上下文

需要把"外部输入"（YAML、JSON、HTTP body）转换为内部类型。

## 问题

- 校验只返回"合法/不合法"，不产出类型化数据。
- 领域层被迫处理原始类型（string、unknown）。

## 方案

- **解析在边界，领域只接收类型化数据**。
- 用 zod（或同类库）在 `infrastructure/parsing/` 做解析。
- `domain/` 只 import 类型，不 import zod。
- **边界层是唯一生产者**：`*Input` 类型只由解析函数生产。

## 反面

- 不要让 zod 泄漏到 domain/。
- 不要让调用方手动构造 `*Input`。
- 不要让领域层处理 `unknown`。

## 关联

[[S13]] [[S15]] [[patterns/parse-dont-validate]]

### S13 Smart Constructor

**未来文件路径**：`COLLABORATION/skills/S13-Smart-Constructor.md`
---
id: S13
type: skill
status: active
created: 2026-09-13
updated: 2026-09-13
domains: [ddd, typescript]
applies-to: [W3]
supersedes: null
author: <待填>
---

# S13 Smart Constructor

## 上下文

需要构造一个有不变量的领域对象（值对象、实体）。

## 问题

- 直接 `new` 或字面量构造会绕过校验。
- 不变量分散在多个地方。

## 方案

- 构造函数私有（`private constructor`）。
- 提供静态工厂 `create`（可能失败）或 `of`（信任输入）。
- `create` 返回 `Result<T, Issue>`。
- **每个值对象独立承担自己的不变量**。
- 跨值对象的不变量由上层聚合的 `create` 承担。

## 反面

- 不要暴露 `constructor`。
- 不要用 `as` 断言绕过构造。
- 不要在 `create` 里塞太多不相关的校验。

## 关联

[[S12]] [[S24]] [[patterns/value-object-as-raw-material]]

### S14 Issue 值对象

**未来文件路径**：`COLLABORATION/skills/S14-Issue-值对象.md`
---
id: S14
type: skill
status: active
created: 2026-09-13
updated: 2026-09-13
domains: [ddd]
applies-to: [W3]
supersedes: null
author: <待填>
---

# S14 Issue 值对象

## 上下文

需要表达"校验发现的问题"。

## 问题

- 用 DTO 承载 Issue 会丢失行为。
- 散落字面量（`severity: 'error'`）无法集中管理。

## 方案

- Issue 是**有行为的值对象**（不是 DTO）：
  - `isBlocking()`
  - `format()`
  - `withSuggestion()`
  - `equals()`
- **工厂集中在 `Issues` 命名空间**（或 `Issue` 静态方法）。
- 业务代码中不出现裸字面量。

## 反面

- 不要把 Issue 做成实体（Issue 无独立身份）。
- 不要在规则里手写 Issue 结构。

## 关联

[[S13]] [[S17]]

### S15 TS 类型工厂

**未来文件路径**：`COLLABORATION/skills/S15-TS-类型工厂.md`
---
id: S15
type: skill
status: active
created: 2026-09-13
updated: 2026-09-13
domains: [typescript]
applies-to: [W3]
supersedes: null
author: <待填>
---

# S15 TS 类型工厂

## 上下文

需要从 const object 派生出联合类型，或把值域映射到类型。

## 问题

- 重复手写联合类型会漂移。
- `typeof X[keyof typeof X]` 每次写太啰嗦。

## 方案

```ts
// shared/types.ts
export type ValueOf<T> = T[keyof T];
export type NonEmptyArray<T> = readonly [T, ...T[]];
export type Brand<T, B extends string> = T & { readonly __brand: B };

// shared/zod-helpers.ts
export function enumOf<T extends Record<string, string>>(
  obj: T,
): z.ZodEnum<[ValueOf<T>, ...ValueOf<T>[]]> {
  const values = Object.values(obj);
  const [first, ...rest] = values;
  if (first === undefined) throw new Error('enumOf: empty object');
  return z.enum([first, ...rest]);
}
```

## 反面

- 不要用 TS `enum` 关键字（编译产物重、不 tree-shake）。
    
- 不要让 zod schema 和 const object 各维护一份值。
    
- 不要手写 `as [T, ...T[]]`（用"首件检验"模式）。
    

## 关联

[[S12]] [[S21]]


### S16 TSDoc 规范

**未来文件路径**：`COLLABORATION/skills/S16-TSDoc-规范.md`

---
id: S16
type: skill
status: active
created: 2026-09-13
updated: 2026-09-13
domains: [typescript, documentation]
applies-to: [all]
supersedes: null
author: <待填>
---



# S16 TSDoc 规范

## 上下文

公开导出的类型/函数需要让使用者快速理解其用途。

## 问题

- 注释缺失或格式混乱。
- 只写"怎么做"，不写"为什么"。

## 方案

- **首句摘要**：一句话说明用途。
- **`@remarks`**：为什么这样做、什么时候不该用。
- **`@typeParam` / `@param` / `@returns` / `@throws`**：签名相关。
- **`@example`**：复杂 API 必须给。
- **`@see`**：关联 API。
- **`@deprecated` / `@internal`**：状态标记。

### 必须写 TSDoc 的场景

| 场景 | 是否必须 |
| :--- | :--- |
| 公开导出的类型/函数 | ✅ |
| 领域核心概念（值对象、实体） | ✅ |
| 复杂算法 | ✅ |
| 内部实现细节 | ⚪ 可选 |
| 显而易见的 getter/setter | ❌ |

## 反面

- 不要为每个变量写注释。
- 不要用中文冒号替代 `@tag`。
- 不要只写"这个函数做什么"而不写"为什么"。

## 关联

[[S8]] [[patterns/pattern-language]]

### S17 ESLint 工具约束

**未来文件路径**：`COLLABORATION/skills/S17-ESLint-工具约束.md`
---
id: S17
type: skill
status: active
created: 2026-09-13
updated: 2026-09-13
domains: [typescript, tooling]
applies-to: [all]
supersedes: null
author: <待填>
---

# S17 ESLint 工具约束

## 上下文

口头约定会被遗忘，规则不会。

## 问题

- 分层依赖靠自觉。
- 类型导入风格不统一。
- 魔法数字/字符串散落。

## 方案

### 关键规则清单

| 规则 | 作用 |
| :--- | :--- |
| `@typescript-eslint/consistent-type-imports` | 强制 `import type` |
| `@typescript-eslint/no-import-type-side-effects` | 防止 `import type` 被误用 |
| `@typescript-eslint/consistent-type-assertions` | 禁止 `as` 断言（例外：`brand.ts`） |
| `@typescript-eslint/no-explicit-any` | 禁止 `any` |
| `@typescript-eslint/no-floating-promises` | 防止未 await |
| `no-magic-numbers` | 禁止魔法数字（先 warn） |
| `import/no-restricted-paths` | 分层约束（白名单） |
| `import/no-extraneous-dependencies` | 禁止 `shared/` import 外部库 |

### 分层约束（白名单）

**domain** 只允许 import `domain/` 和 `shared/`。  
**shared** 只允许 import `shared/`。

## 反面

- 不要用 `// eslint-disable-next-line` 绕过真问题。
- 不要用黑名单（穷举禁止项），用白名单（穷举允许项）。
- 不要一次上所有规则——先 warn 再 error。

## 关联

[[A8]] [[S12]] [[patterns/allowlist-over-denylist]]

### S18 演化日志三层身份

**未来文件路径**：`COLLABORATION/skills/S18-演化日志三层身份.md`
---
id: S18
type: skill
status: active
created: 2026-09-13
updated: 2026-09-13
domains: [meta]
applies-to: [W5]
supersedes: null
author: <待填>
---

# S18 演化日志三层身份

## 上下文

演化日志需要记录"谁在什么时候提议了什么、谁确认"。

## 问题

- "AI + 用户"太笼统。
- 缺少 commit 关联。
- 无法审计决策链。

## 方案

### 三层身份

| 层 | 位置 | 内容 |
| :--- | :--- | :--- |
| **Commit** | git log | git 身份（name + email + GPG） |
| **YAML** | 条目 frontmatter | `author` / `co-authors` |
| **Evolution-log** | `meta/evolution-log.md` | 提议者 + 确认者 + commit hash + 关联 ID |

### 确认者规则（承接 A6）

| 层级 | 确认者 |
| :--- | :--- |
| 约定 | 双方 |
| 工作流 | 用户 |
| 技能 | 单人 |
| 模式 | 单人 |
| ADR | 双方 |

### 身份标识

- 用户：git email
- AI：统一写 `AI`
- 未确定：`user@local (待补)`

## 反面

- 不修改历史条目。
- 不用假 email。
- 不省略确认者。

## 关联

[[A4]] [[A6]] [[W5]]

### S19 Make-or-Buy（货架商品）

**未来文件路径**：`COLLABORATION/skills/S19-Make-or-Buy.md`
---
id: S19
type: skill
status: active
created: 2026-09-13
updated: 2026-09-13
domains: [meta]
applies-to: [all]
supersedes: null
author: <待填>
---

# S19 Make-or-Buy（货架商品）

## 上下文

面对一个新问题，是否引入现成依赖？

## 问题

- 盲目引入依赖导致复杂度膨胀。
- 盲目自研导致重复造轮子。

## 方案

### 三步决策

| 步 | 动作 |
| :--- | :--- |
| 1. 侦查 | 搜索 GitHub / npm / 论坛 |
| 2. 分析 | 评估成熟度、维护状态、依赖成本 |
| 3. 决策 | 引入 / 自研 / 简化后自研 |

### 判据

- **自己实现 < 50 行且无边界情况** → 自研
- **现成方案成熟且成本可控** → 引入
- **现成方案太重但思路有用** → 简化后自研

## 反面

- 不要因为"以后可能会用"而引入。
- 不要因为"自己写能学东西"而重复造轮子。
- 不要把依赖当成"免思考的借口"。

## 关联

[[A8]] [[patterns/dependency-decision]]

### S20 Result.all 组合

**未来文件路径**：`COLLABORATION/skills/S20-Result-all-组合.md`
---
id: S20
type: skill
status: active
created: 2026-09-13
updated: 2026-09-13
domains: [typescript]
applies-to: [S13]
supersedes: null
author: <待填>
---

# S20 Result.all 组合

## 上下文

需要把多个 `Result` 组合成一个大 `Result`（全部成功 → 成功；任一失败 → 失败）。

## 问题

- 手动 `if (a.ok && b.ok && c.ok)` 冗长。
- 用 `as` 断言绕过类型窄化会破坏 Result 的封闭性。

## 方案

```ts
export function all<T, E>(results: readonly Result<T, E>[]): Result<T[], E[]> {
  const values: T[] = [];
  const errors: E[] = [];
  for (const r of results) {
    if (r.ok) values.push(r.value);
    else errors.push(r.error);
  }
  return errors.length > 0 ? Err(errors) : Ok(values);
}

````

**变长元组版本**（保留所有位置类型）需要 mapped type——见未来 S25。

## 反面

- 不要用 `throw` 处理"某些 Result 失败"（违反 Result 封闭性）。
    
- 不要在组合时用 `as { ok: true }` 断言。
    

## 关联

[[S13]] [[S25]]


### S21 Branded Type

**未来文件路径**：`COLLABORATION/skills/S21-Branded-Type.md`
---
id: S21
type: skill
status: active
created: 2026-09-13
updated: 2026-09-13
domains: [typescript]
applies-to: [S13]
supersedes: null
author: <待填>
---

# S21 Branded Type

## 上下文

TS 是结构化类型系统，`string` 无法区分 `EntryId` 和 `EmailAddress`。

## 问题

- 两个语义不同的 `string` 互相赋值不报错。
- 值对象无法在类型层面与裸类型区分。

## 方案

```ts
// shared/brands.ts
declare const ISODateBrand: unique symbol;
export type ISODate = string & { readonly [ISODateBrand]: true };

```

- `declare const ... : unique symbol`：编译期存在，运行时不存在。
    
- **断言集中在 `brand.ts`**，其他文件 ESLint 禁止 `as`。
    
- 值对象工厂内部是唯一允许 `as` 的地方。
    

## 反面

- 不要散落 `as` 断言。
    
- 不要为每个 `string` 都造 branded type——只给有语义的。
    
- 不要忘记在 ESLint 里配 `consistent-type-assertions`。
    

## 关联

[[S13]] [[S17]]

### S22 路径别名
**未来文件路径**：`COLLABORATION/skills/S22-路径别名.md`
id: S22
type: skill
status: active
created: 2026-09-13
updated: 2026-09-13
domains: [typescript, tooling]
applies-to: [all]
supersedes: null
author: <待填>
---
# S22 路径别名
## 上下文
深层目录的 `../../../domain/...` 可读性差，重构时容易漏改。
## 问题
- 相对路径随目录移动而失效。
- 依赖层级不显式。
## 方案
- `tsconfig.json` 的 `paths`：`"@/*": ["src/*"]`
- 编译时用 `tsc-alias` 重写路径
- 测试运行时用 `vitest.config.ts` 的 `resolve.alias`
**使用**：`import { ... } from '@/domain/entry/types.js'`。
## 反面
- 不要混用相对路径和别名（同一项目内保持一致）。
- 不要忘了运行时也需要配置 alias（tsconfig 只管编译期）。
- 不要让 alias 掩盖分层违规（用 `no-restricted-paths` 单独管）。
## 关联
[[S17]] [[S23]]

### S23 TDD 工作流

**未来文件路径**：`COLLABORATION/skills/S23-TDD-工作流.md`
---
id: S23
type: skill
status: active
created: 2026-09-13
updated: 2026-09-13
domains: [meta]
applies-to: [W8]
supersedes: null
author: <待填>
---

# S23 TDD 工作流

## 上下文

需要写可维护、可验证的代码。

## 问题

- 后写测试覆盖不到边界。
- 实现先行容易偏离规格。

## 方案

### 红 → 绿 → 重构

1. **红**：先写测试，跑，看它失败。
2. **绿**：写最简实现让它通过。
3. **重构**：改善实现，测试仍通过。

### 领域层 TDD 的特殊优势

- 领域层是纯函数，**不需要 mock**。
- 最快反馈。
- 从底向上：值对象 → 规则 → 用例 → 集成。

### 顺序

| 顺序 | 写什么 | 反馈速度 |
| :--- | :--- | :--- |
| 1 | 值对象测试 | 最快 |
| 2 | 规则测试 | 快 |
| 3 | 用例测试（fake loader） | 中 |
| 4 | IO 集成测试（临时目录） | 慢 |
| 5 | CLI 端到端测试 | 最慢 |

## 反面

- 不要为无行为的 DTO 写测试。
- 不要在没有失败测试的情况下写实现。
- 不要跳过"红"直接写实现和测试。

## 关联

[[W8]] [[S26]]

### S24 create vs of

**未来文件路径**：`COLLABORATION/skills/S24-create-vs-of.md`
---
id: S24
type: skill
status: active
created: 2026-09-13
updated: 2026-09-13
domains: [ddd, typescript]
applies-to: [S13]
supersedes: null
author: <待填>
---

# S24 create vs of

## 上下文

值对象和实体的工厂方法命名不统一，读者无法判断"是否会失败"。

## 问题

- 有的叫 `of`，有的叫 `create`，语义混乱。
- 调用方不知道要不要处理失败。

## 方案

| 方法 | 使用场景 | 是否失败 |
| :--- | :--- | :--- |
| **`create`** | 从**原始输入**构造，需校验不变量 | ✅ 返回 `Result` |
| **`of`** | 从**已知合法**的值构造 | ❌ 直接返回 |
| **`from`** | 从**另一种类型**转换 | 视情况 |

### 值对象 vs 实体

| 类型 | 主构造 |
| :--- | :--- |
| 值对象 | `create`（可能失败） |
| 实体 | `create` + `rehydrate`（从持久层恢复，信任数据） |

## 反面

- 不要让 `of` 出现在公共 API（它假设输入已合法）。
- 不要用 `create` 命名不失败的构造。

## 关联

[[S13]] [[S24]]

### S25 combineResult 变长元组

**未来文件路径**：`COLLABORATION/skills/S25-combineResult-变长元组.md`
---
id: S25
type: skill
status: draft
created: 2026-09-13
updated: 2026-09-13
domains: [typescript]
applies-to: [S20]
supersedes: null
author: <待填>
---

# S25 combineResult 变长元组

## 上下文

`S20` 的 `all` 是简化版——所有 Result 的值类型相同。当值类型不同时（如 `Result<EntryId>`, `Result<ISODate>`），需要保留每个位置的类型。

## 问题

- `all([Ok(1), Ok('a')])` → `Result<[number | string], ...>`，丢失元组位置。
- 需要 `Result<[number, string], ...>`。

## 方案

用 mapped type 保留每个位置：

```ts
export function combineResult<T extends readonly unknown[], E>(
  results: { [K in keyof T]: Result<T[K], E> },
): Result<T, E[]> {
  // ...
}

```
**状态**：草案。等 S20 简化版在真实场景下不够用时，再落地。

## 反面

- 不要为了"类型完备"而牺牲"易用"。
    
- 简化版够用时，不引入变长元组版本。
    

## 关联

[[S20]]

### S26 测试文件布局
**未来文件路径**：`COLLABORATION/skills/S26-测试文件布局.md`

---
id: S26
type: skill
status: active
created: 2026-09-13
updated: 2026-09-13
domains: [meta]
applies-to: [all]
supersedes: null
author: <待填>
---
# S26 测试文件布局
## 上下文
测试文件放哪里，团队常不一致。
## 问题
- 混用 `test/` 和 `__tests__/`。
- 测试与源码分离导致修改时不同步。
## 方案
- **统一用 `__tests__/` 子目录**。
- 测试与源文件在同一模块目录下，通过 `__tests__/` 区分。
- **不允许** `*.test.ts` 直接与源文件同层混放。
- 集成 / E2E 测试可另设顶层 `tests/` 目录（如果必要）。
## 反面
- 不要混用 `test/` 和 `__tests__/`。
- 不要把测试集中到顶层 `tests/`（除非是集成/E2E）。
## 关联
[[S23]]

### S27 规格优先 review

**未来文件路径**：`COLLABORATION/skills/S27-规格优先-review.md`
---
id: S27
type: skill
status: active
created: 2026-09-13
updated: 2026-09-13
domains: [meta]
applies-to: [W8]
supersedes: null
author: <待填>
---

# S27 规格优先 review

## 上下文

在 AI 协作中，用户 review 的对象需要从"实现"上移到"规格"。

## 问题

- 用户凭直觉扫代码，拦不住错误。
- 实现细节的 review 认知负担高、拦截效果低。

## 方案

- **规格先行**：用自然语言/示例/表格描述行为，用户 review 通过后写测试。
- **测试 review**：用户看 `it` 标题（即行为），不看每个 `expect`。
- **类型 review**：只看接口/契约。
- **实现 review**：只有前三层通过后才进行。

### 规格编写技巧

- 用"输入分类法"穷举边界（空/单行/多行/特殊字符/代码块）。
- 列出所有"待决策的设计点"，每点给"选项 + 推荐 + 理由"。
- **凡涉及 interface 变更，必须列出"所有构造函数/实现点"清单**。

## 反面

- 不要让用户直接读大段代码。
- 不要在规格里出现"可能这样也可能那样"（不确定即未想透）。
- 不要让规格变成需求复述——它应该有决策。

## 关联

[[W8]] [[A10]]

### S28 值对象静态方法用显式类名

**未来文件路径**：`COLLABORATION/skills/S28-值对象静态方法用显式类名.md`
---
id: S28
type: skill
status: active
created: 2026-09-13
updated: 2026-09-13
domains: [typescript, ddd]
applies-to: [S13]
supersedes: null
author: <待填>
---

# S28 值对象静态方法用显式类名

## 上下文

值对象的静态工厂方法内部，需要调用其他静态成员。

## 问题

- 用 `this.of(...)` 看似简洁，但引入对调用方式的隐性依赖。
- 解构/回调传递时，`this` 会丢失。

## 方案

- 值对象（final 类型）的静态方法内部，**用显式类名**（`Issue.of`），**不用 `this.of`**。
- 理由：值对象没有子类，`this` 的多态性无价值，却引入隐患。

### 例外

非值对象（有继承体系的类、可扩展的框架类）可以用 `this` 实现模板方法模式。

## 反面

- 不要为了"少 6 个字符"引入 `this`。
- 不要在值对象里设计子类。

## 关联

[[S13]] [[S24]]

### S29 批替换决策

**未来文件路径**：`COLLABORATION/skills/S29-批替换决策.md`

---
id: S29
type: skill
status: active
created: 2026-09-13
updated: 2026-09-13
domains: [meta, tooling]
applies-to: [all]
supersedes: null
author: <待填>
---

# S29 批替换决策（脚本 vs IDE）

## 上下文

需要在项目中批量替换文本或重命名标识符。

## 问题

- 无判据时，有时用 IDE、有时用脚本，不一致。
- 用错工具会导致编码混乱、误匹配。

## 方案

### 判据表

| 条件 | 脚本 | IDE |
| :--- | :---: | :---: |
| 改动 > 10 处 | ✅ | ⚠️ |
| 需多步有序替换 | ✅ | ❌ |
| 涉及编码/换行敏感内容 | ✅ | ⚠️ |
| 需要条件逻辑 | ✅ | ❌ |
| 需要事后审计/重跑 | ✅ | ❌ |
| **语义级重命名** | ❌ | ✅ |
| 改动 3-5 处 | ❌ | ✅ |
| 需要实时预览 | ❌ | ✅ |

### 经验规则

- **超过 10 处 / 含逻辑 / 需要重跑** → 脚本
- **少于 10 处 / 纯重命名 / 需要人眼确认** → IDE

### 脚本方案的溢出价值

- **可复用**：跨项目、跨仓库使用。
- **可 git 化**：脚本本身进版本控制。
- **可审计**：每步可 review。
- **团队资产**：把"一次性动作"变成"可共享资产"。

## 反面

- 不要用 PowerShell 一行命令做复杂替换（Unicode 边界 + 编码陷阱）。
- 不要用 IDE 做 AST 无法理解的文本替换。
- 不要忘记先备份（或确认 git clean）。

## 关联

[[S30]] [[patterns/feature-discovery-over-hardcoded-paths]]

### S30 批处理脚本骨架

**未来文件路径**：`COLLABORATION/skills/S30-批处理脚本骨架.md`

---
id: S30
type: skill
status: active
created: 2026-09-13
updated: 2026-09-13
domains: [tooling]
applies-to: [S29]
supersedes: null
author: <待填>
---

# S30 批处理脚本骨架

## 上下文

需要跨文件批量替换/重构。

## 问题

- PowerShell `-replace` 的 `\b` 是 Unicode 边界（中文旁不匹配）。
- `Set-Content` 会改编码（PS 5.1 ANSI、PS 7 UTF-8 with BOM）。
- `-NoNewline` 会移除文件末尾换行。

## 方案

### 用 Node 脚本，不用 Shell

```js
// scripts/rename-something.mjs
import fs from 'node:fs';
import path from 'node:path';

const REPLACEMENTS = [
  { from: /(?<![A-Za-z0-9_])OldName(?![A-Za-z0-9_])/g, to: 'NewName' },
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

let changed = 0;
for (const file of walk('src')) {
  const original = fs.readFileSync(file, 'utf8');
  let modified = original;
  for (const { from, to } of REPLACEMENTS) modified = modified.replace(from, to);
  if (modified !== original) {
    fs.writeFileSync(file, modified, 'utf8');
    changed++;
  }
}
console.log(`${changed} file(s) updated.`);

```

### 关键点

- **`(?<![A-Za-z0-9_])` + `(?![A-Za-z0-9_])`**：显式 ASCII 边界，跨引擎一致。
    
- **`fs.readFileSync(file, 'utf8')` + `fs.writeFileSync(file, ..., 'utf8')`**：UTF-8 无 BOM，换行保留原样。
    
- **先备份或确认 git clean**。
    
- **执行后跑验证命令**（grep 检查是否还有旧名）。
    

## 反面

- 不要用 PowerShell `-replace` + `Set-Content` 组合。
    
- 不要用 `\b`（不同引擎语义不同）。
    
- 不要在未备份的情况下运行。
    

## 关联

[[S29]]

## 四、模式 Patterns
### patterns/parse-dont-validate
**未来文件路径**：`COLLABORATION/patterns/parse-dont-validate.md`

---
id: parse-dont-validate
type: pattern
status: active
source: 函数式编程（Alexis King）
---
# Parse, don't validate
## 上下文
需要把外部输入转换为内部类型。
## 问题
- 校验只返回布尔值，不产出类型化数据。
- 领域层被迫处理原始类型。
## 方案
- **边界负责解析**：接收 `unknown`，输出类型化的 `*Input`。
- **领域只接收类型化数据**。
- **边界层是唯一生产者**，领域层是唯一消费者。
- 类型校验（形状）在边界；业务不变量在领域。
## 反面
- 不要让领域层处理 `unknown`。
- 不要让边界层做业务校验。
- 不要让调用方手动构造 `*Input`。
## 关联
[[S12]] [[S13]] [[patterns/value-object-as-raw-material]]

### patterns/dependency-decision

**未来文件路径**：`COLLABORATION/patterns/dependency-decision.md`

---
id: dependency-decision
type: pattern
status: active
source: 供应链管理（Make-or-Buy）
---

# 依赖决策三问 + 位置三问

## 上下文

需要引入新依赖或放置新文件。

## 方案

### 引入三问

1. **问题**：没有它，我会遇到什么具体问题？
2. **收益**：收益有多大？能否量化？
3. **成本**：学习、升级、体积、锁定、攻击面。

**三问答不上来 → 不加**。

### 位置三问

1. **它属于哪一层？**（领域 / 应用 / 基础设施 / CLI）
2. **它会泄漏到其他层吗？**（如领域层 import zod）
3. **如果替换它，要改多少地方？**

**领域层永远不 import 第三方**。

### 设计决策姊妹条款

**每个设计决策都要能说出"没有它，我会遇到什么具体问题"。**

## 反面

- 不要用"最佳实践"作为理由。
- 不要用"以后可能"作为理由。
- 不要为了"统一"牺牲"语义准确"。

## 关联

[[A8]] [[S19]] [[patterns/allowlist-over-denylist]]

### patterns/naming-as-definition

**未来文件路径**：`COLLABORATION/patterns/naming-as-definition.md`
---
id: naming-as-definition
type: pattern
status: active
source: 语言哲学（命名即定义）
---

# 命名即定义

## 上下文

需要命名类型、常量、函数、文件。

## 方案

### 单一值 vs 集合

| 名字形态 | 命名模式 | 例子 |
| :--- | :--- | :--- |
| 像"单一值" | 同名模式（type + value） | `EntryId` |
| 像"集合/类别" | `*Values` + 同名 type | `EntryKindValues` + `EntryKind` |

### 避免环境冲突

命名前检查：

1. `@types/node` 里是否有全局声明？
2. 主流框架是否有同名？
3. DDD/CQRS 核心术语？（Entity、Port、Adapter、Command）
4. TS 内建？（Record、Array、Map、Set、Partial、Pick）

**任何一条命中 → 改名**。

### 语义精确

- 枚举值用 const object，不用裸字符串。
- 常量名必须能读出业务语义。

## 反面

- 不要用 `EntryType`（与 `perf_hooks.EntryType` 冲突）。
- 不要用 `Record`（与 TS 内建冲突）。
- 不要用"通用的 0"替代语义常量。

## 关联

[[S15]] [[A11]] [[patterns/allowlist-over-denylist]]

### patterns/type-as-design

**未来文件路径**：`COLLABORATION/patterns/type-as-design.md`

---
id: type-as-design
type: pattern
status: active
source: 类型论
---

# 类型即设计

## 上下文

TS 的类型不只是注释，它是设计的一部分。

## 方案

- 重复三次的类型推导 → 抽成工具类型。
- 有语义的 `string` → 用 branded type。
- 有约束的 id → 用 template literal type。
- 工厂的输入 → 用 `*Input` 命名，让工厂成为唯一消费者。
- DTO 不要伪装成领域对象。

## 反面

- 到处写 `typeof X[keyof typeof X]`。
- 用 `string` 表示一切。
- `*Input` / `*DTO` 混在 `domain/` 里。

## 关联

[[S15]] [[S21]] [[patterns/naming-as-definition]]

### patterns/value-object-as-raw-material

**未来文件路径**：`COLLABORATION/patterns/value-object-as-raw-material.md`

---
id: value-object-as-raw-material
type: pattern
status: active
source: 制造业（原料-商品-工厂）
---

# 值对象是原料

## 上下文

DDD 战术设计中，值对象的定位不清晰。

## 方案

| DDD 概念 | 比喻 | 说明 |
| :--- | :--- | :--- |
| **值对象** | **原料** | 最基本的、不可变的、有业务含义的单位 |
| 实体 | 商品 | 有身份、有生命周期 |
| 工厂 | 生产线 | 保证原料/商品满足不变量 |
| 仓储 | 仓库 | 存储与取出 |
| 领域服务 | 跨工厂流程 | 需要多个工厂协作 |

**没有原料，商品造不出来。原料不合格，商品全废。**

## 反面

- 不要把 DTO 伪装成值对象。
- 不要为无业务行为的 DTO 写工厂。
- 不要让值对象成为"数据容器"。

## 关联

[[S13]] [[S14]] [[patterns/type-as-design]]

### patterns/cross-domain-borrowing

**未来文件路径**：`COLLABORATION/patterns/cross-domain-borrowing.md`
---
id: cross-domain-borrowing
type: pattern
status: active
source: A9
---

# 跨域借鉴五步法

## 上下文

面对非平凡问题，工程内部思路已穷尽。

## 方案

1. **识别问题本质**：把工程问题抽象为"哪类问题"（分类？协调？防御？演化？）。
2. **寻找同构领域**：哪些领域在解决同类问题？
3. **提取解决模式**：该领域的核心手段是什么？
4. **映射回工程**：具体变成什么代码/流程/规则？
5. **跑 A8 三问**：映射是否真的解决具体问题？成本是什么？

## 反面

- 不要为了"显得有深度"而堆砌名词。
- 不要强行类比不相干领域。
- 不要把"借鉴"当终点。

## 关联

[[A9]] [[A8]]

### patterns/allowlist-over-denylist

**未来文件路径**：`COLLABORATION/patterns/allowlist-over-denylist.md`
---
id: allowlist-over-denylist
type: pattern
status: active
source: 安全工程
---

# 白名单优于黑名单

## 上下文

需要限制某层的依赖范围。

## 问题

- 黑名单需要穷举所有禁止项，维护成本高且容易遗漏。
- 新增依赖时容易忘记加规则。

## 方案

- 声明**允许什么**，而非**禁止什么**。
- 例子（ESLint 分层约束）：

```js
{
  target: './src/domain',
  from: './src',
  except: ['./domain', './shared'],   // ← 白名单：只允许 domain 和 shared
}
```

## 反面

- 不要用"禁止 domain import zod/lodash/axios..."的黑名单。
    
- 不要假设"没想到的依赖就不用禁止"。
    

## 关联

[[S17]] [[patterns/dependency-decision]]

### patterns/structure-over-algorithm
**未来文件路径**：`COLLABORATION/patterns/structure-over-algorithm.md`
---
id: structure-over-algorithm
type: pattern
status: active
source: 计算机科学（Wirth: 程序 = 数据结构 + 算法）
---
# 结构优先
## 上下文
面对复杂逻辑，习惯直接想"算法"。
## 方案
- **先问"数据结构对不对"，再问"算法怎么写"**。
- 结构对了，算法自然简化；结构错了，算法再优也是负收益。
### 应用
| 场景 | 算法思维 | 结构思维 |
| :--- | :--- | :--- |
| 复杂条件判断 | 更长的 if-else | 策略模式/表驱动 |
| 状态管理 | 更多变量追踪 | 状态机 |
| 分层架构 | 每层写更多检查 | 依赖方向约束 |
| 团队协作 | 靠约定和 review | 靠目录结构和 ESLint |
## 反面
- 不要否定算法——结构优先，不代表算法不重要。
- 不要用"结构"作为不写算法细节的借口。
## 关联
[[S17]] [[patterns/allowlist-over-denylist]]

### patterns/three-level-dry

**未来文件路径**：`COLLABORATION/patterns/three-level-dry.md`

---
id: three-level-dry
type: pattern
status: active
source: 软件工程（DRY）
---

# 不重复原则的三个层次

## 上下文

DRY 是常识，但常被误解为"代码文本不重复"。

## 方案

### 层次一：代码级 DRY

- **DRY 针对"知识"，不针对"代码文本"**。
- 两个看起来相同的代码，如果业务含义不同，强行合并会导致耦合。

### 层次二：系统级复用

- 不要重复封装（已有 `Result`，不再写 `Either`）。
- 组合优于重复。
- 扩展优于修改。

### 层次三：知识级复用（货架商品）

- 遇到新问题，先侦查现成方案。
- 分析是否值得引入。
- 从零实现 vs 引入依赖 vs 简化后自研。

## 反面

- 不要因为"文本相同"就合并。
- 不要因为"想学"就重复造轮子。
- 不要因为"想省事"就盲目引入。

## 关联

[[S19]] [[patterns/dependency-decision]]

### patterns/qian-systems-engineering

**未来文件路径**：`COLLABORATION/patterns/qian-systems-engineering.md`
---
id: qian-systems-engineering
type: pattern
status: active
source: 钱学森《组织管理的技术——系统工程》
---

# 钱学森系统工程思想

## 上下文

软件系统日益复杂，需要"整体"而非"局部"的思维方式。

## 方案

### 五个核心思想

1. **系统工程是组织管理的技术**：它解决实际问题，不是纯理论。
2. **用不那么可靠的元器件组成高度可靠的系统**：分层防御的核心。
3. **整体论与还原论的辩证统一**：拆解为了理解，但不能忘记整体。
4. **综合集成：定性 + 定量**：人的判断 + 机器的规则。
5. **总体设计部**：专门的协调实体（如 `application/` 层）。

## 反面

- 不要用"还原论"拆解到看不见整体。
- 不要用"整体论"拒绝拆解。
- 不要把系统工程当成"数学公式"。

## 关联

[[patterns/layered-defense]]

### patterns/feature-discovery-over-hardcoded-paths

**未来文件路径**：`COLLABORATION/patterns/feature-discovery-over-hardcoded-paths.md`
---
id: feature-discovery-over-hardcoded-paths
type: pattern
status: active
source: 航海导航（星辰定位）
---

# 特征发现优于硬编码路径

## 上下文

需要在目录树中定位（项目根、git 仓库、配置目录）。

## 问题

- `path.resolve(__dirname, '../../..')` 依赖"层级数"。
- 目录一移动，路径就崩。
- 跨平台行为不一致。

## 方案

**用"标志物"定位，不用"相对层级"**。

| 目标 | ❌ 硬编码 | ✅ 特征发现 |
| :--- | :--- | :--- |
| 项目根 | `../../..` | 向上找 `package.json` |
| git 仓库 | `path.join(__dirname, '../repo')` | 向上找 `.git` |
| COLLABORATION | 硬编码路径 | 向上找 `COLLABORATION/` |
| tsconfig | `./tsconfig.json` | 向上找 `tsconfig.json` |

### 骨架

```ts
function findUp(startDir: string, marker: string): string | null {
  let dir = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(dir, marker))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
```

## 反面

- 不要假设"从 A 到 B 有几层"。
    
- 不要在测试里硬编码 `../../..`。
    
- 不要用"位置"作为"身份"。
    

## 关联

[[S29]] [[S30]] [[patterns/structure-over-algorithm]]

### patterns/adapter-internal-structure
**未来文件路径**：`COLLABORATION/patterns/adapter-internal-structure.md`

---
id: adapter-internal-structure
type: pattern
status: active
source: 六边形架构（Alistair Cockburn）
---
# 适配器内部结构自由
## 上下文
需要组织"命令层"和"CLI 工具"的位置。
## 问题
- 把 `commands/` 和 `lib/` 放在 `src/` 顶层——它们无法归入任何架构层。
- 未来接入 HTTP API 时，`commands/` 名字被占用。
## 方案
**每个适配器有自己的一亩三分地**。
```text
src/
├── application/       ← 用例层（层）
├── domain/            ← 领域核心（层）
├── infrastructure/    ← 共享技术设施（层）
├── shared/            ← 零依赖工具（层）
├── cli/               ← 适配器 1（含 commands/ 和 lib/）
└── http/              ← 适配器 2（未来）

```
**适配器内部结构不影响领域和应用层**——所以可以自由组织。

### 依赖方向
```
       domain
         ↑
    application
     ↗       ↖
  cli     infrastructure
```

**适配器和基础设施可以互相依赖**——它们都是外层。

## 反面

- 不要把适配器的内部结构提升为顶层目录。
    
- 不要让领域/应用层依赖适配器。
## 关联

[[W3]] [[S7]] [[patterns/feature-discovery-over-hardcoded-paths]]

### patterns/layered-defense（保留自 v3/v4）
已在 v4 中存在的模式，**不重复**。

## 五、ADR
### 新增：ADR-0003 采用 Spike 前置阶段
**未来文件路径**：`COLLABORATION/meta/decision-records/ADR-0003-采用-Spike-前置阶段.md`

---
id: ADR-0003
type: adr
status: accepted
date: 2026-09-13
author: <待填>
---
# ADR-0003 采用 Spike 前置阶段
## 背景
TDD 假设"问题空间已明确"。当问题空间不明确（如 `collab new` 的模板该长什么样）时，TDD 会失真——写出"我以为是这样的"测试。
## 决策
在 A10 流程的"规格"阶段之前，插入可选的 Spike 阶段。
- Spike 目标：学习。
- Timebox：默认 2 小时。
- 代码：不保留。
- 产出：写入规格的知识。
## 后果
正面：
- 避免错误 TDD 的成本。
- 用最少成本回答"能不能做"和"接口该长什么样"。
- 保持 A10 的严谨性——Spike 结束后进入正式流程。
负面：
- 增加一轮迭代时间。
- 可能被滥用为"跳过 TDD"的借口。
## 替代方案
- 直接 TDD：否决，问题空间不明确时无法写出正确测试。
- 完全跳过 Spike：同上。
## 关联
[[A10]] [[W8]] [[W9]] [[patterns/cross-domain-borrowing]]

## 六、元层更新

### meta/evolution-log-format.md（新增）

**未来文件路径**：`COLLABORATION/meta/evolution-log-format.md`
---
id: evolution-log-format
type: meta
status: active
created: 2026-09-13
updated: 2026-09-13
author: <待填>
---

# evolution-log 格式规范

## 字段

| 字段 | 含义 | 必填 |
| :--- | :--- | :--- |
| 日期 | 变更生效日 | 是 |
| 版本 | 语义化版本 | 是 |
| 变更 | 一句话描述 | 是 |
| 提议者 | 谁提出 | 是 |
| 确认者 | 谁批准生效 | 是 |
| commit | 关联 git commit | 否（未提交用 `-`） |
| 关联 | 涉及条目 ID | 否 |

## 确认者规则（承接 A6）

| 层级 | 确认者 |
| :--- | :--- |
| 约定 | 双方 |
| 工作流 | 用户 |
| 技能 | 单人 |
| 模式 | 单人 |
| ADR | 双方 |

## 身份标识

- 用户：git email
- AI：`AI`
- 多人：`,` 分隔
- 未确定：`user@local (待补)`

## 反面

- 不修改历史条目。
- 不用假 email。
- 不省略确认者。

## 关联

[[A4]] [[A6]] [[S18]]

### meta/naming-conventions.md（追加）

在 v4 已有的 naming-conventions 里追加：

## 命名的六个检查项

1. 是否为 `@types/node` 的全局声明？（`declare type X`）
2. 是否与主流框架的内建类型同名？
3. 是否与 DDD/六边形/CQRS 核心术语重名？（Entity、Port、Adapter、Command、Event）
4. 是否与 TS 内建类型重名？（Record、Array、Map、Set、Partial、Pick）
5. 是否与 JS 关键字冲突？（class、function、delete、let）
6. 名字形态是"单一值"还是"集合"？（决定同名模式 vs `*Values` 模式）

**任何一条命中 → 改名**。

## 冲突案例

| 名字 | 冲突源 | 改名 |
| :--- | :--- | :--- |
| `EntryType` | `perf_hooks.EntryType` | `EntryKind` |
| `EntryTypeValues` | 连带 | `EntryKindValues` |
| `EntryTypeDir` | 连带 | `EntryKindDir` |

### meta/pruning-policy.md（追加）

追加：
## 社区同步策略

- 主干合并后，fork 通过 `collab sync` 拉取。
- 某条目被 ≥ 3 个 fork 引用 → 提升为独立技能。
- 某条目在主干 dormant 但在 ≥ 1 个 fork active → 先讨论再决定。
- 主干定期扫描 fork，吸收高价值条目。

## 七、演化日志追加

`COLLABORATION/meta/evolution-log.md` 追加：
日期版本变更提议者确认者commit关联2026-09-13v4.1.0批量落地：A10 补充 + A11 + W8/W9 + S12-S30 + 12 模式 + ADR-0003 + 元层更新AI（提议）user@local (待补)-A11, W8, W9, S12-S30, ADR-0003