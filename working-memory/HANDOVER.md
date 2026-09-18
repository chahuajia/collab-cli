# 交接：给下一个 Agent

**写于**：2026-09-19  
**读者**：新开对话的 Agent（不是给用户的作业）  
**当前总状态**：**⏸ 暂停**。用户未说「继续」之前：**不要派子代理、不要 merge 下一波、不要 push。**

真相仓是 evolutionary；本文件在 collab-cli（当前 Cursor 工作区）。两边都有副本指针。

---

## 30 秒定位

你在压 **COLLABORATION 规范能否指导真实项目**，不是在做换电产品。代码是手段。

| 仓 | 绝对路径 | 角色 | 当前 |
| :--- | :--- | :--- | :--- |
| **collab-cli** | `D:\actto\front\project\collab-cli\collab-cli` | 本工作区；CLI/MCP/validate；编排指针 | 分支 `collab-new` |
| **evolutionary** | `D:\actto\front\project\evolutionary_start\evolutionary` | 换电实现 + 项目 WM/规格 | `topic/fe-ddd-rsc` · HEAD **`303dc35`** · 与 origin 同步、工作区干净 |
| **collaboration** | `D:\actto\front\project\collaboration_aggregate\collaboration` | 长期 KB | 不要写项目日记；L3 harvest 须用户确认 |

用户语言：**简体中文**。本地 commit 可以；**AI 不 push**。「继续」≠ merge 到 `version/v0`、≠ push。

---

## 现在停在哪（evo-collab-extreme）

**任务**：InMemory → JPA 落库（无人值守双 worktree 集群）。  
**loop 真相**：`evolutionary/working-memory/tasks/evo-collab-extreme/loop.md`  
**本仓指针**：`working-memory/tasks/evo-collab-extreme/loop.md`

| 项 | 值 |
| :--- | :--- |
| 状态 | ⏸ 暂停（用户 2026-09-18 19:17：跑完本轮后暂停、**不要再派集群**） |
| 已合入 | wave31–41（commerce/credit/mall/settlement 清零；iot 前半 DeviceShadow+Telemetry） |
| HEAD | `303dc35` `refactor(domain): 将独立的枚举类合并到对应的领域类内部`（用户 heiniao 提交并已与 origin 同步） |
| 上一 merge | `374d5fd` wave41 45b TelemetryStore |
| wave42 | **只建了 worktree，未派出 Task** |

wave42 已备、恢复时才用：

- `D:\actto\front\project\evolutionary_start\evo-wt-46a-be` · `wave42/46a-alert-store-jpa` · 基线 `374d5fd`（比当前 HEAD 旧，恢复时建议从 `303dc35` 重建或 rebase）
- `D:\actto\front\project\evolutionary_start\evo-wt-46b-be` · `wave42/46b-maintenance-ticket-jpa` · 同上

**恢复口令**：用户明确说「继续」。然后：

1. 刷新 46a/46b 到 `303dc35`（旧 worktree 不含 enum 内嵌，硬 merge 会痛）
2. 双路 Task：AlertStore ∥ MaintenanceTicket（`IotConfig` 会冲突，父收口）
3. iot 清零后再派 operator：Organization / PackageTemplate / PackageOverride / OnboardingApplication（AuditLog 已 JPA）

**父进程只做**：merge、冲突、验绿、WM。失败只接管一路。子代理 **composer-2.5-fast**、短 brief、**单消息双 Task**。本地 commit、不 push。

历史 worktree（35a–45b）大量残留（约 20+ 棵）。暂停收口时用户未要求 prune；不要擅自 `worktree remove`。恢复前可问用户是否清旧树。

---

## 硬规则（违反会被用户纠正）

1. **不 push**；不 `--force`；不跳过 hook。  
2. **暂停期间 idle 允许 >0**，禁止 auto-dispatch。  
3. **WM 双写**：改 git 之后立刻写 evolutionary `loop.md` **和** 本仓 `AGENTS.md` 活跃表 + 指针 loop。先 git 再登记 HEAD，勿空登记。  
4. **collaboration 不写轮次日记**；拦截先记 `evolutionary/working-memory/interceptions-candidates.md`。  
5. **domain 零 Spring/JPA**（`DomainFrameworkFreeTest`）。application 层用户已同意可适度放宽（如将来 `@Transactional`），但不要把 Bean Validation / `@Entity` 推进 domain。  
6. 中文 commit / 注释 / WM。回答从 H2 开始，不客套。  
7. 子代理完成通知 = **同轮 merge + 验绿**；暂停中 **到此为止**，不要续派。

集群坍缩根因（已写入 loop「反坍缩 v3」）：follow-up 通知只汇报不 merge；用户插问转答疑后忘续派；WM 不刷新。**插问不暂停 pipeline——除非用户说暂停。**

---

## Collaboration：怎么用（不要全量读）

KB 入口：`collaboration/AGENTS.md` **症状表**（不要先读 catalog 当路由）。

| 场景 | 做 |
| :--- | :--- |
| 设计墙（不变量、依赖、边界、错误码） | 症状表 1 行 → 读 1–2 条 → 决策 |
| 机械 JPA 切片 | **不读 KB**；对标上一切片 + 目标测绿 |
| 跨对话进度 | 读本文件 + 对应仓 `working-memory/`，不读 KB 全文 |
| 入库 / 新条目 | **人触发**；说不出「不看它称职模型会做错」就别建 |

对照实验（D 实验）结论：有规格的实现任务，读库改变 SUMMARY、**不改变代码结构**，墙钟更长。拦截账本里的「差点」多为自述，不是「因为读了才对」。项目特异决定（S34 映射、RSC、共享内核）属于 evolutionary 决策，不是通用 pattern 发行包。

详细评估见本对话（2026-09-18～19）；外部对照笔记：`e:\file\notes\前端\ai\` 下 claude / codex / DeepSeek 建议.md。

---

## 本会话已拍板、未全部落代码的架构

| 题 | 结论 | 代码状态 |
| :--- | :--- | :--- |
| AOP | domain 绝对纯净；application 可白名单（事务宜放 interfaces/infrastructure） | 全仓仍无 `@Aspect` / 几乎无 `@Transactional`；注释「同事务双写」与实现不一致（`PerformSwap`） |
| 事件 | 现用 Fact record + Controller 同步调用；不必上总线 | 保持 |
| 命令模式 / CQRS | 现有 `execute()` 即写侧；读写分离先拆端口，不要 GoF Command | 保持 |
| enum | 单聚合生命周期 → `Aggregate.Status` 内嵌；跨聚合共享词汇保持独立 | **已 commit** `303dc35`。`BatteryStatus`、`OrgCapability` **故意不内嵌** |
| Config 种子 | 程序化 `ApplicationRunner` / Bean 内 save，不换 data.sql | 有意：走领域工厂、跨 BC ID 对齐、H2 重启重置 |
| `OrgCapability` | BC 级能力枚举，被 Organization **和** OnboardingApplication 共用，不要塞进 Organization | 保持独立文件 |

---

## 代码地图（evolutionary backend）

包按 BC：`swap/` `station/` `battery/` `commerce/` `credit/` `mall/` `settlement/` `iot/` `operator/` `admin/`，每模块 `domain / application / infrastructure / interfaces`。

JPA 模式（对标即可，勿创新）：

- domain：`rehydrate(...)` 回放  
- `XxxJpaEntity` + Spring Data `XxxJpaRepository` + `@Component JpaXxxRepository`  
- `*Config` 去掉 InMemory `@Bean`，留 JPA 注释  
- `InMemory*` **文件保留**，Spring 不注入  
- 测试：`@SpringBootTest` + `deleteAllInBatch`，至少 2 例  

Windows PowerShell：`mvn -q test "-Dtest=A,B"`（`-Dtest=a,b` 无引号会解析失败）。

`SettlementConfig` / `IotConfig` / `MallConfig` 等双路改同一文件 → **父收口冲突**，禁止残留 `<<<<<<`。

---

## 恢复后的默认下一刀

1. iot：AlertStore ∥ MaintenanceTicket → iot JPA 清零  
2. operator：四仓储 InMemory → JPA（Organization 种子在 **Bean 构造时**写入，供 `OrgAuthorization` index，不能只靠 ApplicationRunner）  
3. 可选债：`PerformSwap.execute` 真事务；application 层 `DomainFrameworkFreeTest` 放宽 Spring、仍禁 JPA  

前端 `topic/fe-ddd-rsc`：目标 RSC + 按 BC 视图模型，决策表仍标「待实施」——**不要在暂停的 JPA 集群里夹带大改前端**，除非用户点名。

---

## 不要做

- 把项目报告写进 `collaboration/meta/evolution-log`  
- 为「有产出」新建 KB 条目  
- 把 wave42 派出去（除非用户说继续）  
- 假设 `evolutionary/AGENTS.md` 全文仍准：它仍写「刚建立 / battery-pressure 待 backend 实现」，**以后端代码 + 本 HANDOVER + loop.md 为准**  
- 把 `cli-agent-boundaries`「禁止 commit」与无人值守「feat commit 当凭证」当成同一条——本任务惯例是 **L2 切片本地 commit、不 push**；有疑问问用户，不要发明第三套规则  

---

## 读序（新对话）

1. 本文件  
2. `collab-cli/working-memory/AGENTS.md` 活跃表  
3. `evolutionary/working-memory/tasks/evo-collab-extreme/loop.md`  
4. 需要设计决策时：`collaboration/AGENTS.md` 症状表 → 1–2 条正文  
5. 需要跑代码：`evolutionary` HEAD + `backend/` 对标最近一个 `Jpa*Repository`
