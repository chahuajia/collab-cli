import path from "node:path";
import { ApplyUseCase } from "@/application/ApplyUseCase";
import { buildBundle } from "@/application/buildBundle";
import { buildCatalog } from "@/application/buildCatalog";
import {
  ValidateUseCase,
  contentRules,
  standardRules,
} from "@/application/ValidateUseCase";
import { findCollabRoot } from "@/cli/lib/findCollabRoot";
import { BundleActionValues } from "@/domain/apply/BundleAction";
import { parseCollabText } from "@/domain/parse/parseCollabText";
import { sha256Hex } from "@/infrastructure/crypto/sha256";
import { FileApplyWorkspace } from "@/infrastructure/fs/FileApplyWorkspace";
import { FileWorkspaceLoader } from "@/infrastructure/fs/FileWorkspaceLoader";
import { parseBundle } from "@/infrastructure/parsing/BundleParser";
import { ToolArgumentError, readInt, readRecord, readString } from "@/mcp/args";
import type { Entry } from "@/domain/entry/Entry";
import type { Issue } from "@/domain/validation/Issue";

/** 工具运行时的上下文（进程级，不随请求变化）。 */
export interface ToolContext {
  /** 服务器启动时的工作目录 —— 用于解析相对的 `dir` 参数。 */
  readonly cwd: string;
  /** 默认知识库根（启动时解析一次）；解析失败为 null。 */
  readonly dir: string | null;
}

/** 工具的执行结果。 */
export interface ToolOutcome {
  readonly text: string;
  readonly isError: boolean;
}

const JSON_INDENT = 2;

const DEFAULT_CATALOG_LIMIT = 200;
const MAX_CATALOG_LIMIT = 1000;
const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 100;

/** 搜索片段：命中点前后各取多少字符。 */
const SNIPPET_RADIUS = 80;

/**
 * 命中强度。
 *
 * @remarks
 * 这三档值本身没有业务含义，只是**排序权重**；写死在这里是因为
 * "为什么 id 命中排在标题命中前面"必须一眼可读 —— 排名一旦需要解释，
 * 就该用名字而不是数字。
 */
const RANK_ID = 3;
const RANK_TITLE = 2;
const RANK_BODY = 1;
const RANK_NONE = 0;

/**
 * 执行一个工具。
 *
 * @remarks
 * **绝不在这里调用 `cmd*` 函数。** 那些函数会 `console.log` 到 stdout 并
 * `process.exit` —— 在 MCP 服务器里，往 stdout 写任何非协议内容都会
 * **破坏协议流**，而 `process.exit` 会直接杀死服务器。
 * 所以这里只复用**用例**（application）与**端口实现**（infrastructure）。
 *
 * @throws {ToolArgumentError} 参数不合法（调用方的错）
 */
export function runTool(
  name: string,
  rawArgs: Readonly<Record<string, unknown>>,
  ctx: ToolContext,
): ToolOutcome {
  switch (name) {
    case "collab_catalog":
      return catalogTool(rawArgs, ctx);
    case "collab_read":
      return readTool(rawArgs, ctx);
    case "collab_search":
      return searchTool(rawArgs, ctx);
    case "collab_validate":
      return validateTool(rawArgs, ctx);
    case "collab_parse":
      return parseTool(rawArgs, ctx);
    case "collab_apply_plan":
      return applyPlanTool(rawArgs, ctx);
    default:
      throw new ToolArgumentError(`unknown tool: ${name}`);
  }
}

// ─────────────────────────────────────────────
// 工具实现
// ─────────────────────────────────────────────

/**
 * 路由表：条目清单。
 *
 * @remarks
 * 只在内存里生成（`buildCatalog` 是纯函数），**不写 `catalog.json`** ——
 * 写盘是 `collab catalog` 的事。只读工具不该有副作用。
 */
function catalogTool(
  args: Readonly<Record<string, unknown>>,
  ctx: ToolContext,
): ToolOutcome {
  const dir = resolveCollabDir(args, ctx);
  const typeFilter = readString(args, "type");
  const statusFilter = readString(args, "status");
  const limit = readInt(args, "limit", DEFAULT_CATALOG_LIMIT, 1, MAX_CATALOG_LIMIT);

  const workspace = new FileWorkspaceLoader(dir).load();
  const catalog = buildCatalog(workspace, {
    generatedAt: new Date().toISOString(),
  });

  const filtered = catalog.entries.filter(
    (entry) =>
      (typeFilter === null || entry.type === typeFilter) &&
      (statusFilter === null || entry.status === statusFilter),
  );

  return {
    text: toJson({
      dir,
      summary: catalog.summary,
      matched: filtered.length,
      returned: Math.min(filtered.length, limit),
      entries: filtered.slice(0, limit),
    }),
    isError: false,
  };
}

/**
 * 读一条条目（按 id 或路径）。
 */
function readTool(
  args: Readonly<Record<string, unknown>>,
  ctx: ToolContext,
): ToolOutcome {
  const dir = resolveCollabDir(args, ctx);
  const id = readString(args, "id");
  const relPath = readString(args, "path");
  const bodyOnly = args.bodyOnly === true;

  if (id === null && relPath === null) {
    throw new ToolArgumentError("`id` or `path` is required");
  }

  const workspace = new FileWorkspaceLoader(dir).load();
  for (const loaded of workspace.entries) {
    if (loaded.entry === null) continue;
    const matches = id !== null
      ? loaded.entry.frontmatter.id === id
      : samePath(loaded.path, relPath);
    if (!matches) continue;

    return {
      text: toJson(
        bodyOnly
          ? { id: loaded.entry.frontmatter.id, path: loaded.path, body: loaded.entry.body }
          : {
              dir,
              path: loaded.path,
              frontmatter: frontmatterToJson(loaded.entry),
              body: loaded.entry.body,
            },
      ),
      isError: false,
    };
  }

  return {
    text: toJson({
      dir,
      found: false,
      id,
      path: relPath,
      hint: "用 collab_catalog 或 collab_search 先定位条目",
    }),
    isError: true,
  };
}

/**
 * 搜索：id / 标题 / 正文。
 *
 * @remarks
 * 排序刻意简单（id 命中 > 标题命中 > 正文命中），**不做模糊匹配** ——
 * 排名算法一旦"聪明"，就没法解释为什么某条排第一，
 * 而那正是 agent 决定读哪条的依据。
 */
function searchTool(
  args: Readonly<Record<string, unknown>>,
  ctx: ToolContext,
): ToolOutcome {
  const dir = resolveCollabDir(args, ctx);
  const query = readString(args, "query");
  if (query === null) throw new ToolArgumentError("`query` is required");
  const limit = readInt(args, "limit", DEFAULT_SEARCH_LIMIT, 1, MAX_SEARCH_LIMIT);

  const needle = query.toLowerCase();
  const workspace = new FileWorkspaceLoader(dir).load();
  const matches: Record<string, unknown>[] = [];

  for (const loaded of workspace.entries) {
    if (loaded.entry === null) continue;
    const fm = loaded.entry.frontmatter;
    const title = titleOf(loaded.entry);

    const rank = rankOf(needle, fm.id, title, loaded.entry.body);
    if (rank === RANK_NONE) continue;

    matches.push({
      id: fm.id,
      type: fm.type,
      status: fm.status,
      title,
      path: loaded.path,
      rank,
      snippet: snippetOf(loaded.entry.body, needle, title),
    });
  }

  matches.sort((a, b) => {
    const rankA = typeof a.rank === "number" ? a.rank : 0;
    const rankB = typeof b.rank === "number" ? b.rank : 0;
    if (rankA !== rankB) return rankB - rankA;
    const idA = typeof a.id === "string" ? a.id : "";
    const idB = typeof b.id === "string" ? b.id : "";
    return idA.localeCompare(idB);
  });

  return {
    text: toJson({
      dir,
      query,
      matched: matches.length,
      returned: Math.min(matches.length, limit),
      matches: matches.slice(0, limit),
    }),
    isError: false,
  };
}

/**
 * 校验：把 `ValidationReport` 投影成结构化 JSON。
 */
function validateTool(
  args: Readonly<Record<string, unknown>>,
  ctx: ToolContext,
): ToolOutcome {
  const dir = resolveCollabDir(args, ctx);
  const scope = readString(args, "scope") ?? "standard";
  if (scope !== "standard" && scope !== "content") {
    throw new ToolArgumentError('`scope` must be "standard" or "content"');
  }

  const { entries, report } = new ValidateUseCase(
    new FileWorkspaceLoader(dir),
    scope === "content" ? contentRules : standardRules,
  ).execute();

  const errors = report.errors().length;
  const warnings = report.warnings().length;

  return {
    text: toJson({
      dir,
      scope,
      entries: entries.length,
      summary: { errors, warnings },
      issues: report.issues.map(issueToJson),
    }),
    // 有 error 就是失败 —— 让调用方（模型）无法把"红了"读成"绿了"
    isError: errors > 0,
  };
}

/**
 * A17 文本 → bundle（**不落盘**）。
 */
function parseTool(
  args: Readonly<Record<string, unknown>>,
  ctx: ToolContext,
): ToolOutcome {
  const dir = resolveCollabDir(args, ctx);
  const text = readString(args, "text");
  if (text === null) throw new ToolArgumentError("`text` is required");

  const parsed = parseCollabText(text);
  if (!parsed.ok) {
    return {
      text: toJson({
        dir,
        parsed: false,
        issues: parsed.error.map(issueToJson),
      }),
      isError: true,
    };
  }

  const bundle = buildBundle({
    blocks: parsed.value,
    workspace: new FileApplyWorkspace(dir),
    hasher: sha256Hex,
    generatedAt: new Date().toISOString(),
    generatedBy: "collab mcp",
  });

  const creates = bundle.files.filter((f) => f.action === "create").length;

  return {
    text: toJson({
      dir,
      parsed: true,
      fileCount: bundle.files.length,
      summary: { create: creates, replace: bundle.files.length - creates },
      bundle,
    }),
    isError: false,
  };
}

/**
 * 预演落盘计划（**永远不写盘**）。
 */
function applyPlanTool(
  args: Readonly<Record<string, unknown>>,
  ctx: ToolContext,
): ToolOutcome {
  const dir = resolveCollabDir(args, ctx);
  const raw = readRecord(args, "bundle");
  if (raw === null) throw new ToolArgumentError("`bundle` is required");

  const input = parseBundle(raw);
  if (!input.ok) {
    return {
      text: toJson({
        dir,
        status: "rejected",
        wrote: 0,
        issues: input.error.map(issueToJson),
      }),
      isError: true,
    };
  }

  const useCase = new ApplyUseCase(new FileApplyWorkspace(dir), sha256Hex);
  const planned = useCase.plan(input.value);
  if (!planned.ok) {
    return {
      text: toJson({
        dir,
        status: "rejected",
        wrote: 0,
        issues: planned.error.map(issueToJson),
      }),
      isError: true,
    };
  }

  const plan = planned.value;
  return {
    text: toJson({
      dir,
      status: "planned",
      wrote: 0,
      summary: {
        create: plan.countOf(BundleActionValues.Create),
        replace: plan.countOf(BundleActionValues.Replace),
        delete: plan.countOf(BundleActionValues.Delete),
      },
      operations: plan.operations.map((operation) => ({
        action: operation.kind,
        path: operation.path,
      })),
      next: "落盘由人在 CLI 执行：collab apply <bundle.json> --dir <dir>（先 --dry-run）",
    }),
    isError: false,
  };
}

// ─────────────────────────────────────────────
// 辅助
// ─────────────────────────────────────────────

/**
 * 解析本次调用要用的知识库根。
 *
 * @remarks
 * 优先级：**本次调用的 `dir` 参数 > 服务器启动时的目录**。
 * 第二个参数必须显式传给 `findCollabRoot`，否则启动时的 `COLLAB_DIR`
 * 会盖掉逐请求的 `dir` —— 那是"进程级状态泄漏到请求级"。
 */
function resolveCollabDir(
  args: Readonly<Record<string, unknown>>,
  ctx: ToolContext,
): string {
  const raw = readString(args, "dir");
  if (raw === null) {
    if (ctx.dir === null) {
      throw new ToolArgumentError(
        "no COLLABORATION workspace found — pass `dir`, or start the server with `collab mcp --dir <path>`",
      );
    }
    return ctx.dir;
  }
  const abs = path.resolve(ctx.cwd, raw);
  return findCollabRoot(abs, abs).collabDir;
}

function samePath(entryPath: string, wanted: string | null): boolean {
  if (wanted === null) return false;
  const normalize = (value: string): string =>
    value.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
  const target = normalize(wanted);
  const actual = normalize(entryPath);
  return actual === target || actual === `${target}.md` || actual.endsWith(`/${target}`);
}

function titleOf(entry: Entry): string {
  const match = /^#\s+(.+?)\s*$/m.exec(entry.body);
  if (match !== null && match[1] !== undefined) return match[1];
  return entry.path.split("/").pop() ?? entry.path;
}

/** 命中强度：id=3 > 标题=2 > 正文=1 > 未命中=0。 */
function rankOf(
  needle: string,
  id: string,
  title: string,
  body: string,
): number {
  if (id.toLowerCase().includes(needle)) return RANK_ID;
  if (title.toLowerCase().includes(needle)) return RANK_TITLE;
  if (body.toLowerCase().includes(needle)) return RANK_BODY;
  return RANK_NONE;
}

/** 取命中点附近的片段（单行，便于模型阅读）。 */
function snippetOf(body: string, needle: string, fallback: string): string {
  const index = body.toLowerCase().indexOf(needle);
  if (index < 0) return fallback;
  const start = Math.max(0, index - SNIPPET_RADIUS);
  const end = Math.min(body.length, index + needle.length + SNIPPET_RADIUS);
  return body.slice(start, end).replace(/\s+/g, " ").trim();
}

/**
 * 序列化 frontmatter。
 *
 * @remarks
 * 逐个字段手写而不是 spread 整个对象：`Frontmatter` 的值对象（EntryId / ISODate）
 * 是有 brand 的字符串，直接展开会把内部结构暴露出去 —— 这是一次**有意的投影**。
 */
function frontmatterToJson(entry: Entry): Record<string, unknown> {
  const fm = entry.frontmatter;
  const payload: Record<string, unknown> = {
    id: fm.id,
    type: fm.type,
    status: fm.status,
    created: fm.created,
    updated: fm.updated,
    domains: fm.domains,
    appliesTo: fm.appliesTo,
    aliases: fm.aliases,
  };
  if (fm.author !== undefined) payload.author = fm.author;
  if (fm.provenance !== undefined) payload.provenance = fm.provenance;
  if (fm.trigger !== undefined) payload.trigger = fm.trigger;
  if (fm.antiTrigger !== undefined) payload.antiTrigger = fm.antiTrigger;
  if (fm.falsifier !== undefined) payload.falsifier = fm.falsifier;
  if (fm.supersedes !== null) payload.supersedes = fm.supersedes;
  if (fm.focus.length > 0) payload.focus = fm.focus;
  if (fm.coAuthors.length > 0) payload.coAuthors = fm.coAuthors;
  // enforced 非空 = 已毕业、已退出路由索引 —— 读条目的人需要知道这件事。
  if (fm.enforced !== null) payload.enforced = fm.enforced;
  return payload;
}

/** Issue → JSON（与 `renderJsonReport` 同形，便于两个入口共用消费代码）。 */
function issueToJson(issue: Issue): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    severity: issue.severity,
    code: issue.code,
    message: issue.message,
  };
  if (issue.path !== undefined) payload.path = issue.path;
  if (issue.suggestion !== undefined) payload.suggestion = issue.suggestion;
  if (issue.docs !== undefined) payload.docs = issue.docs;
  return payload;
}

/** 统一缩进输出 —— 返回值只有一处序列化点。 */
function toJson(value: unknown): string {
  return JSON.stringify(value, null, JSON_INDENT);
}
