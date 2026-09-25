// scripts/lib/entryFrontmatter.ts

/**
 * 条目的 frontmatter 块：定位与重建（**纯字符串**，不碰文件系统）。
 *
 * @remarks
 * 三个数据迁移脚本（`add-author` / `add-dates` / `add-aliases`）原先各自抄了一份
 * "找 `---` 块 + 按原换行符拼回 + 保住 BOM"。这类重复的代价很具体：
 * 修 BOM 那次只改了 `cli/commands/fix.ts`，脚本那三份不会跟着动
 * （2026-09-26 实测：`fix` 曾对带 BOM 的文件报 "frontmatter not found"）。
 */

export interface FrontmatterBlock {
  /** 整篇的行（已剥 BOM、按原文换行符切分） */
  readonly lines: readonly string[];
  /** 收尾 `---` 的行号 */
  readonly endIndex: number;
  /** 原文的换行符（写回时沿用，不静默改成 LF） */
  readonly newline: string;
  /** 原文带 BOM（写回时**原样保留**） */
  readonly hasBom: boolean;
}

const BOM_CODE_POINT = 0xfeff;
const FENCE = "---";

/**
 * 定位 frontmatter 块。
 *
 * @returns 找不到/未闭合时 `null`（调用方据此警告，**不猜**）
 */
export function locateFrontmatter(content: string): FrontmatterBlock | null {
  const hasBom = content.charCodeAt(0) === BOM_CODE_POINT;
  const text = hasBom ? content.slice(1) : content;
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  if (lines[0] !== FENCE) return null;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === FENCE) return { lines, endIndex: i, newline, hasBom };
  }
  return null;
}

/** 在读到的行上做替换，然后**按原文的换行与 BOM** 拼回整篇。 */
export function rebuild(
  block: FrontmatterBlock,
  nextLines: readonly string[],
): string {
  const text = nextLines.join(block.newline);
  return block.hasBom ? `\uFEFF${text}` : text;
}

/** frontmatter 里（`---` 之间）是否已有某个字段。 */
export function hasField(block: FrontmatterBlock, field: string): boolean {
  const pattern = new RegExp(`^${field}\\s*:`);
  for (let i = 1; i < block.endIndex; i++) {
    const line = block.lines[i];
    if (line !== undefined && pattern.test(line)) return true;
  }
  return false;
}

/** `id:` 的值；没有则 `null`。 */
export function readId(block: FrontmatterBlock): string | null {
  for (let i = 1; i < block.endIndex; i++) {
    const match = /^id:\s*(.+)$/.exec(block.lines[i] ?? "");
    if (match?.[1] !== undefined) return match[1].trim();
  }
  return null;
}

/** 在 `status:` 之后插入若干行；没有 `status:` 就插在收尾 `---` 之前。 */
export function insertAfterStatus(
  block: FrontmatterBlock,
  fieldLines: readonly string[],
): readonly string[] {
  let insertAt = block.endIndex;
  for (let i = 1; i < block.endIndex; i++) {
    if (/^status\s*:/.test(block.lines[i] ?? "")) {
      insertAt = i + 1;
      break;
    }
  }
  return [
    ...block.lines.slice(0, insertAt),
    ...fieldLines,
    ...block.lines.slice(insertAt),
  ];
}
