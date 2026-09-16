import { ParseIssues } from "@/domain/parse/ParseIssues";
import { Err, Ok } from "@/shared/Result";
import type { Issue } from "@/domain/validation/Issue";
import type { Result } from "@/shared/Result";

/** 文本协议里的一个块。 */
export interface ParsedFile {
  /** 原样保留的路径（规范化由 `apply` 负责 —— 预检只有一份） */
  readonly path: string;
  /** 与原文**逐字节一致**的内容 */
  readonly content: string;
}

/**
 * 起始标记：`===== FILE: <path> =====`
 *
 * @remarks
 * 按决策 D5 **宽容解析**：`=` 的数量不固定、允许两侧空白。
 * A17 文档里两处结束标记的 `=` 数量就不一致 —— 严格解析会拒绝真实输入。
 */
const FILE_MARKER = /^=+\s*FILE:\s*(.*?)\s*=+\s*$/;

/** 结束标记：`===== END FILE =====`（同样宽容） */
const END_MARKER = /^=+\s*END FILE\s*=+\s*$/;

const MAX_ECHO = 40;

/**
 * 把 A17 文本协议切分成文件块。
 *
 * @remarks
 * **纯函数** —— 不碰文件系统。产出 `bundle.json` 的其余部分（哈希、action 推断）
 * 是 IO，在 CLI 里做。
 *
 * 全有或全无：任何一条不过就返回**全部** Issue，一个块都不产出。
 *
 * @param text - 粘贴来的原文（可能含 AI 的开场白、代码围栏等）
 * @returns 成功返回所有块，失败返回全部 Issue
 */
export function parseCollabText(
  text: string,
): Result<readonly ParsedFile[], readonly Issue[]> {
  const lines = text.split(/\r?\n/);
  const issues: Issue[] = [];
  const files: ParsedFile[] = [];
  const seen = new Set<string>();

  let currentPath: string | null = null;
  let buffer: string[] = [];

  for (const line of lines) {
    const start = FILE_MARKER.exec(line);
    if (start !== null) {
      if (currentPath !== null) {
        issues.push(ParseIssues.invalid(`block "${currentPath}" was never closed`));
      }
      currentPath = (start[1] ?? "").trim();
      buffer = [];
      if (currentPath.length === 0) {
        issues.push(ParseIssues.invalid("a FILE marker has an empty path"));
      }
      continue;
    }

    if (END_MARKER.test(line)) {
      if (currentPath === null) {
        issues.push(
          ParseIssues.invalid("an END FILE marker appeared without a FILE marker"),
        );
        continue;
      }
      collect(currentPath, buffer.join("\n"), files, seen, issues);
      currentPath = null;
      buffer = [];
      continue;
    }

    if (currentPath === null) {
      // 块外的非空白内容 = 粘贴范围错了，必须报（否则会静默丢掉一段）
      if (line.trim().length > 0) {
        issues.push(
          ParseIssues.invalid(`content outside any block: ${truncate(line)}`),
        );
      }
      continue;
    }

    buffer.push(line);
  }

  if (currentPath !== null) {
    issues.push(ParseIssues.invalid(`block "${currentPath}" was never closed`));
  }
  if (files.length === 0 && issues.length === 0) {
    issues.push(ParseIssues.invalid("no FILE blocks found"));
  }

  return issues.length > 0 ? Err(issues) : Ok(files);
}

function collect(
  path: string,
  content: string,
  files: ParsedFile[],
  seen: Set<string>,
  issues: Issue[],
): void {
  if (path.length === 0) return; // 已在起始标记处报过
  if (content.trim().length === 0) {
    issues.push(ParseIssues.emptyBlock(path));
    return;
  }
  if (seen.has(path)) {
    issues.push(ParseIssues.duplicatePath(path));
    return;
  }
  seen.add(path);
  files.push({ path, content });
}

function truncate(line: string): string {
  return line.length > MAX_ECHO ? `${line.slice(0, MAX_ECHO)}…` : line;
}
