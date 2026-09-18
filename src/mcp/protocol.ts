import { Err, Ok } from "@/shared/Result";
import type { Result } from "@/shared/Result";

/**
 * MCP（Model Context Protocol）协议的最小实现面。
 *
 * @remarks
 * **不引入官方 SDK。** 本服务器只用到 JSON-RPC 2.0 的收发 + 五个方法，
 * 而仓库的运行依赖刻意保持在两个（yaml / zod）。协议细节取自 MCP 规范：
 *
 * - **stdio 传输**：每行一条 JSON-RPC 消息，行内不得有换行；
 *   服务器**不得**往 `stdout` 写任何非协议内容（日志一律走 `stderr`）。
 * - **两个时代**：`2026-07-28` 起协议无状态 —— 版本随**每个请求**的 `_meta`
 *   传递，没有 `initialize` 握手；`2025-11-25` 及更早仍是握手制。
 *   所以要做**双时代（dual-era）**：两种入口都认。
 */

/** 支持的协议版本（新 → 旧）。 */
export const MCP_PROTOCOL_VERSIONS = [
  "2026-07-28",
  "2025-11-25",
  "2025-06-18",
] as const;

export type McpProtocolVersion = (typeof MCP_PROTOCOL_VERSIONS)[number];

/** 默认对外声明的版本。 */
export const LATEST_PROTOCOL_VERSION: McpProtocolVersion = "2026-07-28";

/**
 * "现代"（无握手）协议的起点。
 *
 * @remarks
 * 版本号是 ISO 日期，可直接按字典序比较。只有"现代"版本的响应才带
 * `resultType` —— 旧的客户端可能按严格 schema 校验，多一个字段就是错。
 */
const MODERN_EPOCH = "2026-07-28";

/**
 * 该版本是否属于"现代"（逐请求携带 `_meta`、无握手）协议。
 */
export function isModernVersion(version: string): boolean {
  return version >= MODERN_EPOCH;
}

/**
 * 是否是我们支持的版本。
 */
export function isSupportedVersion(
  version: string,
): version is McpProtocolVersion {
  for (const candidate of MCP_PROTOCOL_VERSIONS) {
    if (candidate === version) return true;
  }
  return false;
}

/** JSON-RPC 2.0 错误码（含 MCP 自定义段）。 */
export const JsonRpcErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  /** MCP：请求声明的协议版本不受支持。 */
  UnsupportedProtocolVersion: -32022,
} as const;

export type JsonRpcId = string | number | null;

/** 需要应答的请求。 */
export interface IncomingRequest {
  readonly kind: "request";
  readonly id: JsonRpcId;
  readonly method: string;
  readonly params: unknown;
}

/** 不需要应答的通知。 */
export interface IncomingNotification {
  readonly kind: "notification";
  readonly method: string;
  readonly params: unknown;
}

export type IncomingMessage = IncomingRequest | IncomingNotification;

/** JSON-RPC 错误对象。 */
export interface JsonRpcError {
  readonly code: number;
  readonly message: string;
  readonly data?: unknown;
}

export interface JsonRpcResponse {
  readonly jsonrpc: "2.0";
  readonly id: JsonRpcId;
  readonly result: unknown;
}

export interface JsonRpcErrorResponse {
  readonly jsonrpc: "2.0";
  readonly id: JsonRpcId;
  readonly error: JsonRpcError;
}

export type OutgoingMessage = JsonRpcResponse | JsonRpcErrorResponse;

/** `_meta` 里协议版本的键名（MCP 规定的前缀式命名）。 */
export const META_PROTOCOL_VERSION = "io.modelcontextprotocol/protocolVersion";

/**
 * 判断一个值是不是"普通对象"。
 *
 * @remarks
 * 用类型守卫而不是 `as` 断言 —— 断言是"我保证"，守卫是"我验证"。
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 从 `params` 的 `_meta` 里取客户端声明的协议版本。
 *
 * @returns 版本字符串；缺字段或形状不对时返回 null（= 未声明）
 */
export function readRequestedVersion(params: unknown): string | null {
  if (!isRecord(params)) return null;
  const meta = params._meta;
  if (!isRecord(meta)) return null;
  const version = meta[META_PROTOCOL_VERSION];
  return typeof version === "string" ? version : null;
}

/**
 * 解析一行输入为 MCP 消息。
 *
 * @remarks
 * 三类失败都被归到 JSON-RPC 错误：不是 JSON（`-32700`）、
 * 不是合法请求对象（`-32600`）。**不抛异常** —— 一行坏输入不该终止服务器。
 */
export function parseIncoming(
  line: string,
): Result<IncomingMessage, JsonRpcError> {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return Err({
      code: JsonRpcErrorCode.ParseError,
      message: `invalid JSON: ${reason}`,
    });
  }

  if (!isRecord(raw)) {
    return Err({
      code: JsonRpcErrorCode.InvalidRequest,
      message: "message must be a JSON object",
    });
  }

  if (raw.jsonrpc !== "2.0") {
    return Err({
      code: JsonRpcErrorCode.InvalidRequest,
      message: 'message must declare "jsonrpc": "2.0"',
    });
  }

  const method = raw.method;
  if (typeof method !== "string" || method.length === 0) {
    return Err({
      code: JsonRpcErrorCode.InvalidRequest,
      message: "message must carry a non-empty `method`",
    });
  }

  const params = raw.params;
  const id = raw.id;

  // 没有 id → 通知（JSON-RPC：通知永远不应答）
  if (id === undefined) {
    return Ok({ kind: "notification", method, params });
  }

  if (typeof id === "string" || typeof id === "number" || id === null) {
    return Ok({ kind: "request", id, method, params });
  }

  return Err({
    code: JsonRpcErrorCode.InvalidRequest,
    message: "`id` must be a string, a number, or null",
  });
}

/**
 * 编码一条消息为单行（含结尾换行）。
 *
 * @remarks
 * `JSON.stringify` 会把内容里的换行转义成 `\n`，所以产物**必然**单行 ——
 * 这正是 stdio 传输要求的"行内不得有换行"。
 */
export function encodeMessage(message: OutgoingMessage): string {
  return `${JSON.stringify(message)}\n`;
}

/**
 * 构造成功响应。
 */
export function successResponse(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

/**
 * 构造错误响应。
 */
export function errorResponse(
  id: JsonRpcId,
  error: JsonRpcError,
): JsonRpcErrorResponse {
  return { jsonrpc: "2.0", id, error };
}

/**
 * 给结果补上 `resultType`（仅"现代"协议）。
 *
 * @remarks
 * 现代协议要求每个结果都带 `resultType`；旧协议没有这个字段，
 * 而严格校验的旧客户端会拒绝未知字段 —— 所以按会话版本**有条件**地加。
 */
export function withResultType(
  result: Readonly<Record<string, unknown>>,
  sessionVersion: string | null,
): Readonly<Record<string, unknown>> {
  if (sessionVersion === null || !isModernVersion(sessionVersion)) return result;
  return { ...result, resultType: "complete" };
}
