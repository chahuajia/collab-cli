// src/application/InitUseCase.ts
import fs from "node:fs";
import path from "node:path";

/**
 * 计划里要写的一个文件：目标相对路径 + 完整内容。
 */
export interface InitFile {
    readonly path: string;
    readonly content: string;
}

/**
 * `collab init` 的计划。
 *
 * @remarks
 * "计划"与"写入"分开，理由与 `ApplyUseCase` 相同：
 * **先把要发生的事算完，再动第一个字节** —— 于是 `--dry-run` 不需要第二套逻辑。
 */
export interface InitPlan {
    /** 需要写入的文件（已存在的不在此列） */
    readonly files: readonly InitFile[];
    /** 已存在、被跳过的相对路径 */
    readonly skipped: readonly string[];
}

export interface BuildInitPlanOptions {
    readonly collabDir: string;
    readonly today: string;
}

/**
 * 用行数组拼内容。
 *
 * @remarks
 * **刻意不用多行模板字符串**：源码文件一旦是 CRLF，模板里的换行就是 CRLF，
 * 生成物就带上了 CRLF。行数组 + `join("\n")` 让换行符由代码决定，不由编辑器决定。
 */
const lines = (xs: readonly string[]): string => xs.join("\n");

/** meta 类文档的 frontmatter（这些不是"条目"，是 extraDocs）。 */
function metaFrontmatter(id: string, today: string, provenance: string): string {
    return lines([
        "---",
        `id: ${id}`,
        "type: meta",
        "status: active",
        `created: ${today}`,
        `updated: ${today}`,
        "author: <your-name>",
        "aliases:",
        `  - ${id}`,
        `provenance: ${provenance}`,
        "---",
        "",
    ]);
}

/**
 * starter 的 AGENTS.md。
 *
 * @remarks
 * 硬约束（见验收 I12）：**里面不得出现任何双链**。
 * 一个新工作区还没有任何条目，写 `[[xxx]]` 就是制造死链 ——
 * 那等于教新用户引用不存在的东西。
 */
function agentsMd(): string {
    return lines([
        "# AGENTS.md",
        "",
        "> AI 进入本项目的入口。人类读者看 `README.md`。",
        "> 原则：**入口指向，不复制内容**。",
        "",
        "## 项目是什么",
        "",
        "<一句话：这个项目做什么、给谁用。>",
        "",
        "## 阅读顺序",
        "",
        "1. 下面那张「症状 → 条目」表（**第一路由**，按\"你要干什么\"组织）",
        "2. `catalog.json` 做关键词检索（它是目录，不是路由）",
        "3. 都没有 → **报告\"找不到\"，不要凭空发明规范**，并记进 `meta/known-gaps.md`",
        "4. 进度与决策**不在这里** —— 在 `working-memory/`",
        "5. 按需读条目，**不要全量读**：`agreements/` 边界 · `workflows/` 剧本 · `skills/` 做法 · `patterns/` 判据",
        "",
        "## 症状 → 条目",
        "",
        "| 遇到的情况 | 先读 |",
        "| :--- | :--- |",
        "| 要设计一个新结构或抽象 | <你的第一条 pattern> |",
        "| 出了故障要定位 | <你的第一条 workflow> |",
        "| 说不清某个决定该不该做 | <你的第一条 agreement> |",
        "",
        "> 第 4 行起由你自己加。**加不上来的症状记 `meta/known-gaps.md`** ——",
        "> 缺口本身比一条更强的规范更值钱。",
        "",
        "## 协作规则（摘要）",
        "",
        "- 回答从 H2 开始；不客套、不堆砌。",
        "- **先给规格再写实现**：规格 > 测试 > 类型 > 实现。",
        "- 每个设计决策要能回答：\"不做会怎样 / 收益是什么 / 成本是什么\"。",
        "- 不确定就问，**不猜**。",
        "- **新增条目必须能说出\"不读它，模型会照着本地哪个模式写错\"**；说不出来就别进库。",
        "",
        "## 边界",
        "",
        "- **AI 不 commit、不 push**：改动留在工作区，由人确认。",
        "- 本文件**不存放**日常进度、任务、决策。",
        "",
    ]);
}

function readmeMd(): string {
    return lines([
        "# <项目名> 协作知识库",
        "",
        "> 它记录**做过什么决定、为什么、什么条件下该推翻**。",
        "> 它不是产品文档，也不是编码规范手册。",
        "",
        "## 怎么用",
        "",
        "- **AI**：从 `AGENTS.md` 开始（那是入口）。",
        "- **人**：从 `AGENTS.md` 的「症状 → 条目」表开始。",
        "",
        "## 目录",
        "",
        "| 路径 | 放什么 |",
        "| :--- | :--- |",
        "| `agreements/` | 不可谈判的边界 |",
        "| `workflows/` | 复杂任务的执行剧本 |",
        "| `skills/` | 可复用的具体做法 |",
        "| `patterns/` | 判据与跨领域借鉴 |",
        "| `meta/interceptions.md` | **收益账本**：这条拦住了什么 |",
        "| `meta/known-gaps.md` | **缺口账本**：这条没能回答什么 |",
        "| `meta/pruning-policy.md` | 条目怎么休眠、毕业、退役 |",
        "| `catalog.json` | 生成物：路由表（**不要手改**） |",
        "| `scripts/collab-validate.mjs` | **唯一的 CLI 调用点** |",
        "",
        "## 验收",
        "",
        "```sh",
        "node scripts/collab-validate.mjs",
        "```",
        "",
    ]);
}

function interceptionsMd(today: string): string {
    return metaFrontmatter("interceptions", today, "收益侧缺失：只有成本被惩罚、没有收益被测量时，系统只会优化\"便宜\"") + lines([
        "# 拦截账本",
        "",
        "## 上下文",
        "",
        "条目库的成本是可见的（每次都要加载、裁决、冲突），收益是不可见的。",
        "**只被惩罚、不被奖励的性状，必然朝\"更便宜\"的方向漂。**",
        "",
        "## 问题",
        "",
        "- 没有一个数字能回答\"这套规范到底值不值\"。",
        "- 修剪没有客观依据：不知道该留哪条、删哪条。",
        "",
        "## 方案",
        "",
        "每次某条目**真实拦住了一个错误**，追加一行：",
        "",
        "| 日期 | 条目 | 拦住了什么 | 如果不拦，后果 | 证据 |",
        "| :--- | :--- | :--- | :--- | :--- |",
        "",
        "### 判据",
        "",
        "- **必须具体**：写\"拦住了什么\"，不写\"很有用\"。",
        "- **必须有证据**：commit / 报错 / 对话片段 —— 没有证据的不算。",
        "- **可以不记**：不是每次协作都有拦截；记流水账会让这个文件自己变成新的熵。",
        "- **条数不要写在这里**：手写的可计算量必然腐烂，数行数请用命令。",
        "",
        "## 反面",
        "",
        "- 不要把它做成\"功劳簿\" —— 它是**测量工具**。",
        "- 不要编造：一条假的拦截记录会让整个账本失去意义。",
        "",
        "## 关联",
        "",
    ]);
}

function knownGapsMd(today: string): string {
    return metaFrontmatter("known-gaps", today, "收益账本只记\"拦住了什么\"，缺\"没能回答什么\"——两条腿缺一条会变成功劳簿") + lines([
        "# 缺口账本",
        "",
        "## 上下文",
        "",
        "规则说\"都没有 → 报告找不到，不要凭空发明规范\"。这条是对的，但它缺后半段：",
        "**报完之后，这个结论去哪了？** 不记下来，下一个人会在同一个地方再撞一次。",
        "",
        "## 问题",
        "",
        "- \"查过了、没有\"和\"根本没查\"长得一模一样。",
        "- 缺口只留在某次对话里，随对话一起消失。",
        "",
        "## 方案",
        "",
        "每次**有人按正确路径检索过、并明确回报\"找不到\"**，追加一行：",
        "",
        "| 日期 | 缺口 | 谁撞到的 | 检索路径 | 现状 | 关闭条件 |",
        "| :--- | :--- | :--- | :--- | :--- | :--- |",
        "",
        "### 判据",
        "",
        "- **必须有\"找过\"**：\"我觉得缺 X\"不算，那是愿望不是缺口。",
        "- **必须写检索路径**：否则下一个人无法判断\"是不是他没找对\"。",
        "- **关闭条件要可验证**：不写\"以后补上\"，写\"什么条件下算关上\"。",
        "- **它与收益账本是一对**：只有收益侧没有缺口侧，账本会变成功劳簿。",
        "",
        "## 反面",
        "",
        "- 不要把它变成**需求清单** —— 只记\"已经被真实需要、但没被满足\"的。",
        "- 不要按缺口直接写条目：先判断这是\"缺条目\"还是\"路由没指到\" ——",
        "  这两者动作完全相反（一个要新增，一个要修入口）。",
        "",
        "## 关联",
        "",
    ]);
}

function pruningPolicyMd(today: string): string {
    return metaFrontmatter("pruning-policy", today, "只增不减的知识库必然腐烂；但\"6 个月一刀切\"需要测量，而没人测量 —— 于是规则从未执行") + lines([
        "# 修剪策略",
        "",
        "## 上下文",
        "",
        "知识库只增不减必然腐烂。但修剪本身有成本：**删错的代价，往往高于多留一条**。",
        "所以问题不是\"要不要删\"，而是\"**凭什么判它该走**\"。",
        "",
        "## 问题",
        "",
        "- 用时间当判据（\"N 个月没引用就删\"）需要测量，而没人测量 → 规则形同虚设。",
        "- 没有出口的系统只有油门，最终产出会逃逸到补丁、外置文档和分支里。",
        "",
        "## 方案",
        "",
        "### 三条出口（缺一条就会只增不减）",
        "",
        "| 出口 | 什么时候用 | 动作 |",
        "| :--- | :--- | :--- |",
        "| **休眠 dormant** | 过时 / 重复 / 表达差 / 未成熟 | 退出路由索引，**文件保留**（git 是基因库） |",
        "| **毕业 graduated** | 内容已被测试或工具固化 | 标记 `enforced`，退出路由索引 —— 它**完成**了，不是过时了 |",
        "| **缺口 known-gaps** | 找过但没找到 | 记一行 + 关闭条件 |",
        "",
        "### 删除前必须分类（不许一刀切）",
        "",
        "| 类型 | 判断 | 处理 |",
        "| :--- | :--- | :--- |",
        "| 过时 | 曾经对，现在错 | 改写成新结论，或标 dormant 并指向替代条目 |",
        "| 重复 | 与另一条重叠 ≥ 50% | 合并，保留被引用更多的那条 |",
        "| 表达差 | 内容对，但没人找得到 | **改写，不删**（问题在检索，不在内容） |",
        "| 未成熟 | 可能有用，但没验证过 | 降级/退出索引，等它被需要时复活 |",
        "",
        "### 红灯也要配动作",
        "",
        "任何仪器（新鲜度、龄期、零增量）**亮红灯后只允许两个动作**：",
        "**更新它**，或**降级归档**。\"知道了但不动\"不是第三个选项 ——",
        "那是这台仪器失效的定义。",
        "",
        "## 反面",
        "",
        "- 不要用时间代替判断：时间只是线索，不是理由。",
        "- 不要因为\"写了很久 / 挺用心\"就保留 —— 沉没成本不是依据。",
        "- 不要把删除理解成销毁：删除 = 退出索引，git 保留基因。",
        "- 不要把\"有问题\"直接理解成\"必须有更多条\" —— 也可能是路由没指到。",
        "",
        "## 关联",
        "",
    ]);
}

function validateScript(): string {
    return lines([
        "#!/usr/bin/env node",
        "// 唯一的 CLI 调用点 —— CI 与 pre-push 都只调它。",
        "//",
        "// 为什么要有这一层：CLI 的来源（本地依赖 / npx / 绝对路径）只应出现在**一处**。",
        "// 否则改一次要改两处，两处必然漂移。",
        "//",
        "// 本机没有全局安装时，用环境变量覆盖：",
        "//   COLLAB_CLI=\"node /path/to/collab-cli/dist/cli/index.js\" node scripts/collab-validate.mjs",
        "import { spawnSync } from \"node:child_process\";",
        "",
        "const CLI = process.env.COLLAB_CLI ?? \"npx --yes collab-cli@^1\";",
        "",
        "const result = spawnSync(`${CLI} validate`, {",
        "  shell: true,",
        "  stdio: \"inherit\",",
        "});",
        "",
        "if (result.error) {",
        "  console.error(\"[collab] 找不到 CLI。三种装法：\");",
        "  console.error(\"  1) npx --yes collab-cli@^1 validate   （最省事，需要能连 npm）\");",
        "  console.error(\"  2) npm i -D collab-cli && npx collab validate\");",
        "  console.error(\"  3) COLLAB_CLI=\\\"node <path>/dist/cli/index.js\\\" 覆盖本文件里的 CLI 变量\");",
        "  process.exit(1);",
        "}",
        "",
        "process.exit(result.status ?? 1);",
        "",
    ]);
}

export function planInitFiles(today: string): readonly InitFile[] {
  return [
    { path: "AGENTS.md", content: agentsMd() },
    { path: "README.md", content: readmeMd() },
    { path: "meta/interceptions.md", content: interceptionsMd(today) },
    { path: "meta/known-gaps.md", content: knownGapsMd(today) },
    { path: "meta/pruning-policy.md", content: pruningPolicyMd(today) },
    { path: "scripts/collab-validate.mjs", content: validateScript() },
  ];
}

/**
 * 生成 starter 计划。
 *
 * @remarks
 * **只增不改**：已存在的路径进 `skipped`，绝不覆盖 ——
 * 用户改过的东西不能被脚手架吃掉。
 */
export function buildInitPlan(opts: BuildInitPlanOptions): InitPlan {
  const { collabDir, today } = opts;
  if (!fs.existsSync(collabDir)) {
    throw new Error(`collabDir 不存在: ${collabDir}`);
  }
  const files: InitFile[] = [];
  const skipped: string[] = [];
  for (const f of planInitFiles(today)) {
    if (fs.existsSync(path.join(collabDir, f.path))) skipped.push(f.path);
    else files.push(f);
  }
  return { files, skipped };
}
/** 写入计划（UTF-8 无 BOM）。 */
export function writeInitPlan(collabDir: string, plan: InitPlan): void {
    for (const f of plan.files) {
        const full = path.join(collabDir, f.path);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, f.content, { encoding: "utf8" });
    }
}