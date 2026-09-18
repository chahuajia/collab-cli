import { COLLAB_VERSION } from "@/cli/lib/version";
import { ToolArgumentError, normalizeArguments } from "@/mcp/args";
import { runTool } from "@/mcp/handlers";
import {
  JsonRpcErrorCode,
  LATEST_PROTOCOL_VERSION,
  MCP_PROTOCOL_VERSIONS,
  encodeMessage,
  errorResponse,
  isRecord,
  isSupportedVersion,
  parseIncoming,
  readRequestedVersion,
  successResponse,
  withResultType,
} from "@/mcp/protocol";
import { MCP_TOOLS, MCP_TOOL_NAMES } from "@/mcp/tools";
import type { ToolContext, ToolOutcome } from "@/mcp/handlers";
import type { IncomingRequest } from "@/mcp/protocol";

/** 服务器身份 —— 出现在 `initialize` 与 `server/discover` 的 `serverInfo` 里。 */
const SERVER_NAME = "collab";
const SERVER_TITLE = "COLLABORATION knowledge base";

/** 给模型看的服务器级说明（`initialize` / `server/discover` 的 `instructions`）。 */
const INSTRUCTIONS =
  "COLLABORATION 知识库的读写通道。先 `collab_catalog` 定位条目，再 `collab_read` 读 1-3 条；" +
  "交付前跑 `collab_validate`。本服务器**不提供** commit / push —— 改动与提交由人决定。";

/**
 * 一次连接的会话状态。
 *
 * @remarks
 * 只保留"决定**响应形状**"所必需的东西：协议版本。
 * 版本决定了要不要带 `resultType`（现代协议要，旧协议不要）。
 */
export interface McpSession {
  protocolVersion: string | null;
}

export function createSession(): McpSession {
  return { protocolVersion: null };
}

/**
 * 处理一行输入，返回要写回的一行（或 null = 不应答）。
 *
 * @remarks
 * **同步**函数：工具本身是同步的，同步 dispatch 保证"一行进 → 一行出"
 * 不会交错，也让测试无需等待事件循环。
 *
 * 三类错误的归属划清了：
 * - **协议错**（坏 JSON、未知方法、坏参数）→ JSON-RPC `error` 响应；
 * - **工具失败**（校验红了、找不到条目）→ 成功响应，但 `isError: true`；
 * - **通知** → 永不应答（JSON-RPC 规定）。
 */
export function dispatch(
  rawLine: string,
  ctx: ToolContext,
  session: McpSession,
): string | null {
  const parsed = parseIncoming(rawLine);
  if (!parsed.ok) {
    return encodeMessage(errorResponse(null, parsed.error));
  }

  const message = parsed.value;
  const declared = readRequestedVersion(message.params);

  if (declared !== null) {
    if (!isSupportedVersion(declared)) {
      if (message.kind === "notification") return null;
      return encodeMessage(
        errorResponse(message.id, {
          code: JsonRpcErrorCode.UnsupportedProtocolVersion,
          message: "Unsupported protocol version",
          data: {
            supported: [...MCP_PROTOCOL_VERSIONS],
            requested: declared,
          },
        }),
      );
    }
    session.protocolVersion = declared;
  }

  // 通知一律不应答。我们实现的通知只有 `notifications/initialized`
  // （旧协议握手的收尾），它的作用仅仅是"客户端已就绪"。
  if (message.kind === "notification") return null;

  switch (message.method) {
    case "initialize":
      return handleInitialize(message, session);
    case "server/discover":
      return handleDiscover(message, session);
    case "tools/list":
      return handleToolsList(message, session);
    case "tools/call":
      return handleToolsCall(message, ctx, session);
    case "ping":
      // 旧协议的存活探测。现代协议已移除，但应答它是无害的。
      return encodeMessage(successResponse(message.id, {}));
    default:
      return encodeMessage(
        errorResponse(message.id, {
          code: JsonRpcErrorCode.MethodNotFound,
          message: `Method not found: ${message.method}`,
        }),
      );
  }
}

// ─────────────────────────────────────────────
// 方法实现
// ─────────────────────────────────────────────

/**
 * 旧协议（<= 2025-11-25）的握手。
 *
 * @remarks
 * 规范要求：客户端声明它支持的版本；**服务器支持就回同一个**，
 * 不支持就回一个自己支持的（不是报错）—— 这是握手制与逐请求制
 * 在错误语义上的关键差别。
 */
function handleInitialize(
  message: IncomingRequest,
  session: McpSession,
): string {
  const requested = readInitializeVersion(message.params);
  const agreed = requested !== null && isSupportedVersion(requested)
    ? requested
    : LATEST_PROTOCOL_VERSION;
  session.protocolVersion = agreed;

  return encodeMessage(
    successResponse(message.id, {
      protocolVersion: agreed,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: SERVER_NAME, title: SERVER_TITLE, version: COLLAB_VERSION },
      instructions: INSTRUCTIONS,
    }),
  );
}

/**
 * 现代协议的能力查询（`server/discover`，规范要求必须实现）。
 *
 * @remarks
 * stdio 上没有 HTTP 状态码可用来做回退探测，所以支持双时代的客户端
 * **先发 `server/discover`**：能通 → 现代；报错 → 退回 `initialize`。
 * 我们两种都实现，所以无论客户端从哪边进来都能用。
 */
function handleDiscover(
  message: IncomingRequest,
  session: McpSession,
): string {
  return encodeMessage(
    successResponse(
      message.id,
      withResultType(
        {
          supportedVersions: [...MCP_PROTOCOL_VERSIONS],
          capabilities: { tools: { listChanged: false } },
          _meta: {
            "io.modelcontextprotocol/serverInfo": {
              name: SERVER_NAME,
              title: SERVER_TITLE,
              version: COLLAB_VERSION,
            },
          },
          instructions: INSTRUCTIONS,
        },
        session.protocolVersion ?? LATEST_PROTOCOL_VERSION,
      ),
    ),
  );
}

function handleToolsList(
  message: IncomingRequest,
  session: McpSession,
): string {
  return encodeMessage(
    successResponse(
      message.id,
      withResultType({ tools: MCP_TOOLS }, session.protocolVersion),
    ),
  );
}

/**
 * 调用工具。
 *
 * @remarks
 * 两种失败被刻意分开（MCP 规范称之为"协议错"与"工具错"）：
 * - 名字不认 / 参数形状不对 → JSON-RPC `error`（**调用方改参数**）；
 * - 工具跑了但结果是红 → 正常响应 + `isError: true`（**改知识库**）。
 * 混在一起的话，模型就无法区分"我调错了"和"世界不对"。
 */
function handleToolsCall(
  message: IncomingRequest,
  ctx: ToolContext,
  session: McpSession,
): string {
  if (!isRecord(message.params)) {
    return encodeMessage(
      errorResponse(message.id, {
        code: JsonRpcErrorCode.InvalidParams,
        message: "`params` must be an object",
      }),
    );
  }

  const name = message.params.name;
  if (typeof name !== "string" || name.length === 0) {
    return encodeMessage(
      errorResponse(message.id, {
        code: JsonRpcErrorCode.InvalidParams,
        message: "`params.name` must be a non-empty string",
      }),
    );
  }

  let outcome: ToolOutcome;
  try {
    if (!MCP_TOOL_NAMES.has(name)) {
      throw new ToolArgumentError(`unknown tool: ${name}`);
    }
    outcome = runTool(name, normalizeArguments(message.params.arguments), ctx);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return encodeMessage(
      errorResponse(message.id, {
        code:
          error instanceof ToolArgumentError
            ? JsonRpcErrorCode.InvalidParams
            : JsonRpcErrorCode.InternalError,
        message: reason,
      }),
    );
  }

  return encodeMessage(
    successResponse(
      message.id,
      withResultType(
        {
          content: [{ type: "text", text: outcome.text }],
          ...(outcome.isError ? { isError: true } : {}),
        },
        session.protocolVersion,
      ),
    ),
  );
}

/** 从 `initialize` 参数里取客户端声明的版本。 */
function readInitializeVersion(params: unknown): string | null {
  if (!isRecord(params)) return null;
  const version = params.protocolVersion;
  return typeof version === "string" ? version : null;
}
