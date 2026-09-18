import { isRecord } from "@/mcp/protocol";

/**
 * 工具参数不合法。
 *
 * @remarks
 * 与"工具执行失败"分开：参数错是**调用方的错**（改参数即可），
 * 执行失败是**环境/内容的错**（要改知识库）。
 * 两者在 MCP 里都返回 `isError: true`，但措辞必须能区分。
 */
export class ToolArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolArgumentError";
  }
}

/**
 * 读一个可选字符串。
 *
 * @returns 缺字段 / 空串 → null；类型不对 → 抛 `ToolArgumentError`
 */
export function readString(
  args: Readonly<Record<string, unknown>>,
  key: string,
): string | null {
  const value = args[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new ToolArgumentError(`\`${key}\` must be a string`);
  }
  return value.length === 0 ? null : value;
}

/**
 * 读一个可选布尔。
 *
 * @remarks
 * 缺字段时返回 `fallback` —— **默认值由调用方给出**，
 * 因为"默认安全"与否是每个工具的语义，不是通用规则。
 */
export function readBoolean(
  args: Readonly<Record<string, unknown>>,
  key: string,
  fallback: boolean,
): boolean {
  const value = args[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") {
    throw new ToolArgumentError(`\`${key}\` must be a boolean`);
  }
  return value;
}

/**
 * 读一个可选整数（带上下界钳制）。
 *
 * @remarks
 * 越界不报错而是**钳制** —— 调用方要的是"别把上下文炸了"，
 * 不是参数审判。类型不对仍然报错。
 */
export function readInt(
  args: Readonly<Record<string, unknown>>,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = args[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new ToolArgumentError(`\`${key}\` must be an integer`);
  }
  return Math.min(Math.max(value, min), max);
}

/**
 * 读一个可选对象（用于内联传 bundle）。
 *
 * @returns 缺字段 → null；类型不对 → 抛 `ToolArgumentError`
 */
export function readRecord(
  args: Readonly<Record<string, unknown>>,
  key: string,
): Record<string, unknown> | null {
  const value = args[key];
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) {
    throw new ToolArgumentError(`\`${key}\` must be an object`);
  }
  return value;
}

/**
 * 把 `arguments` 字段规整成对象。
 *
 * @remarks
 * MCP 允许 `arguments` 缺省（等价于 `{}`）。
 */
export function normalizeArguments(raw: unknown): Record<string, unknown> {
  if (raw === undefined || raw === null) return {};
  if (!isRecord(raw)) {
    throw new ToolArgumentError("`arguments` must be an object");
  }
  return raw;
}
