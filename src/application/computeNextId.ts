import { EntryKindValues, EntryPrefix } from "@/domain/entry/types";
import type { EntryKind } from "@/domain/entry/types";

/**
 * ADR 编号的补零位数。
 */
const ADR_PADDING = 4;

/**
 * 从"现有 id 列表"计算"下一个 id"。
 *
 * @remarks
 * **纯函数** —— 无 IO、无副作用。
 * 数据来源由调用方提供（通常来自 `extractIdsForKind`）。
 *
 * 不变量：
 * - 忽略不匹配当前 kind 前缀的 id。
 * - 按**数值**排序（不是字典序）。
 * - ADR 的编号补零到 4 位。
 * - **pattern 抛错** —— pattern 的 id 是"名字"，无法自动生成。
 *
 * @param existingIds - 现有 id（可能含非法 id，会被忽略）
 * @param kind - 条目类型
 * @returns 下一个 id
 * @throws 当 kind 是 pattern 时
 */
export function computeNextId(
  existingIds: readonly string[],
  kind: EntryKind,
): string {
  if (kind === EntryKindValues.Pattern) {
    throw new Error(
      "Pattern entries require a manual id. Usage: collab new pattern <id>",
    );
  }

  const prefix = EntryPrefix[kind];
  const numbers = existingIds
    .map((id) => extractNumber(id, prefix))
    .filter((n): n is number => n !== undefined);

  const max = numbers.reduce((acc, n) => Math.max(acc, n), 0);
  const next = max + 1;

  if (kind === EntryKindValues.Adr) {
    return `${prefix}${String(next).padStart(ADR_PADDING, "0")}`;
  }
  return `${prefix}${next}`;
}

/**
 * 从 id 中提取数字部分。
 *
 * @remarks
 * - `S12` + prefix `S` → `12`
 * - `Sabc` + prefix `S` → undefined
 * - `X1` + prefix `S` → undefined
 * - `S` + prefix `S` → undefined（空后缀）
 */
function extractNumber(id: string, prefix: string): number | undefined {
  if (!id.startsWith(prefix)) return undefined;
  const rest = id.slice(prefix.length);
  if (!/^\d+$/.test(rest)) return undefined;
  return Number(rest);
}
