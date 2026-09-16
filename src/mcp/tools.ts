/**
 * MCP 工具清单 —— **只有声明，没有实现**。
 *
 * @remarks
 * 工具集刻意是"**读 + 计划**"，不含"写 + 提交"：
 *
 * - `commit` / `push` **根本不存在**：[[A7-分发与社区边界]] 的可执行版是
 *   "AI 不 commit、不 push" —— 在这里它不再是散文，而是**工具表里没有这一项**。
 *   能被规避的规则靠自觉，**不存在的工具**不靠自觉。
 * - 写盘（`collab apply`）也不暴露：MCP 的 `collab_apply_plan` 只出计划，
 *   真正的落盘由人在 CLI 执行。原因见 `working-memory` 的决策记录 ——
 *   一旦在 MCP 里重写"落盘 → 刷 catalog → 门禁"这条流水线，
 *   就出现了第二份真相源，而那正是本会话反复踩的坑。
 *
 * 顺序**固定**（不是字典序也不是随机）：客户端会缓存工具表，
 * 稳定的顺序让缓存与提示词缓存都能命中（规范明确建议）。
 */

/** 单个工具的声明。 */
export interface McpToolDefinition {
  readonly name: string;
  /** 展示名（给人看） */
  readonly title: string;
  /** 给模型读的说明 —— 要写"什么时候用"，不只是"是什么" */
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  /** 行为提示。`readOnlyHint` 为真的工具保证不改盘。 */
  readonly annotations: Readonly<Record<string, unknown>>;
}

/** 所有工具共用的 `dir` 参数。 */
const DIR_PROPERTY = {
  type: "string",
  description:
    "知识库根目录（含 agreements/ 等）。缺省时用服务器的工作区（--dir / COLLAB_DIR / cwd 向上查找）。",
} as const;

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export const MCP_TOOLS: readonly McpToolDefinition[] = [
  {
    name: "collab_catalog",
    title: "COLLABORATION 路由表",
    description:
      "列出知识库里的条目（id / 类型 / 状态 / 标题 / 路径 / 触发条件）。" +
      "**先读这个再读条目正文** —— 它把上下文成本从 O(条目数) 降到 O(命中数)。" +
      "每条的可选 `trigger` / `antiTrigger` 说明'什么时候该读我'，用它来筛。",
    inputSchema: {
      type: "object",
      properties: {
        dir: DIR_PROPERTY,
        type: {
          type: "string",
          description:
            "按类型过滤：agreement / workflow / skill / pattern / adr / integration。",
        },
        status: {
          type: "string",
          description: "按状态过滤：draft / active / dormant / deprecated。",
        },
        limit: {
          type: "integer",
          description: "最多返回多少条（默认 200，上限 1000）。",
        },
      },
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
  {
    name: "collab_read",
    title: "读一条条目",
    description:
      "按 id 或相对路径读取单条条目的完整内容（frontmatter + 正文）。" +
      "先用 `collab_catalog` 或 `collab_search` 定位，再只读命中的 1-3 条。",
    inputSchema: {
      type: "object",
      properties: {
        dir: DIR_PROPERTY,
        id: { type: "string", description: "条目 id，如 A10、S12。" },
        path: {
          type: "string",
          description: "相对知识库根的路径，如 agreements/A10-review-前置原则.md。",
        },
        bodyOnly: {
          type: "boolean",
          description: "只返回正文（省上下文），默认 false。",
        },
      },
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
  {
    name: "collab_search",
    title: "搜索条目",
    description:
      "在 id / 标题 / 正文里搜索关键词，返回带片段与排序的命中列表。" +
      "用途：不知道条目 id 时定位；或确认'某件事到底有没有被写下来'。",
    inputSchema: {
      type: "object",
      properties: {
        dir: DIR_PROPERTY,
        query: { type: "string", description: "关键词（大小写不敏感）" },
        limit: {
          type: "integer",
          description: "最多返回多少条命中（默认 20，上限 100）。",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
  {
    name: "collab_validate",
    title: "校验知识库",
    description:
      "跑全部校验规则，返回结构化 Issue 列表（code / severity / path / message / suggestion）。" +
      "交付前必跑：这是'工作区与规范一致'的唯一验收标准。" +
      "`scope=content` 会跳过索引规则（用于'刚落盘、还没登记进 _index.md'的批次）。",
    inputSchema: {
      type: "object",
      properties: {
        dir: DIR_PROPERTY,
        scope: {
          type: "string",
          enum: ["standard", "content"],
          description:
            "standard（默认）= 内容规则 + 索引规则 + 目录/生成物检查；content = 只查条目自身。",
        },
      },
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
  {
    name: "collab_parse",
    title: "A17 文本 → bundle（只解析，不落盘）",
    description:
      "把 `===== FILE: <path> =====` 形式的文本切成 bundle。" +
      "action 由工作区现状推断（不存在 → create；存在 → replace 且带 base_sha256）。" +
      "纯函数式：不写任何文件，返回的 bundle 可交给 `collab_apply_plan` 预演。",
    inputSchema: {
      type: "object",
      properties: {
        dir: DIR_PROPERTY,
        text: {
          type: "string",
          description: "待切分的完整文本（含 FILE 标记）。",
        },
      },
      required: ["text"],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
  {
    name: "collab_apply_plan",
    title: "预演落盘计划",
    description:
      "对一份 bundle 做预检（路径白名单 / 空内容 / 哈希）+ 冲突检查，返回计划。" +
      "**本工具永远不写盘** —— 落盘由人在 CLI 执行 `collab apply`。" +
      "计划要么完整要么不存在：被拒绝时一个文件都不会被写。",
    inputSchema: {
      type: "object",
      properties: {
        dir: DIR_PROPERTY,
        bundle: {
          type: "object",
          description: "bundle 对象（通常是 collab_parse 的产物）。",
        },
      },
      required: ["bundle"],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
];

/** 工具名集合 —— 用于校验 `tools/call` 的名字。 */
export const MCP_TOOL_NAMES: ReadonlySet<string> = new Set(
  MCP_TOOLS.map((tool) => tool.name),
);
