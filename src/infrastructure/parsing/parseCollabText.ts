// src/infrastructure/parsing/parseCollabText.ts
import { EntryKindDir, isEntryKind } from "@/domain/entry/types";
import { ParseIssues } from "@/domain/parse/ParseIssues";
import { parseDocument } from "@/infrastructure/parsing/FrontmatterParser";
import { Err, Ok } from "@/shared/Result";
import type { EntryKind } from "@/domain/entry/types";
import type { Issue } from "@/domain/validation/Issue";
import type { DocumentParseError } from "@/infrastructure/parsing/FrontmatterParser";
import type { Result } from "@/shared/Result";

/**
 * 切出来的一个块。
 *
 * @remarks
 * `path` 是**派生**的（`EntryKindDir[type] + "/" + id + ".md"`）——
 * 文本里不再携带路径（ADR-0012 三）。
 */
export interface ParsedFile {
  /** 派生路径：目录由 `type` 决定，文件名由 `id` 决定。 */
  readonly path: string;
  /** 与原文**逐字节一致**的内容（frontmatter + body）。 */
  readonly content: string;
}

/**
 * 切分产出。
 *
 * @remarks
 * **成功也可能带 warning**：「跳过并 warn」需要一个不阻断整批的通道（ADR-0012 一）。
 * 若沿用 `Ok(files)`，warning 会在成功路径上被吃掉 —— 那就成了静默丢弃。
 */
export interface ParsedText {
  readonly files: readonly ParsedFile[];
  /**
   * Warning 级 Issue：被跳过的块、被纠正的路径、被跳过的重复块。
   *
   * @remarks
   * **宽容 ≠ 静默**：调用方必须把它报出来（CLI 打到 stderr，MCP 进 JSON）。
   */
  readonly warnings: readonly Issue[];
}

/** 起始标记：`===== FILE: <path> =====` —— **可选冗余**，只作人读提示（ADR-0012 二）。 */
const FILE_MARKER = /^=+\s*FILE:\s*(.*?)\s*=+\s*$/;

/** 结束标记：`===== END FILE =====` —— 同样可选。 */
const END_MARKER = /^=+\s*END FILE\s*=+\s*$/;

/** frontmatter 的定界行。与 `parseDocument` 同判据：必须独占一行、无前后空白。 */
const FRONTMATTER_FENCE = "---";

/** 代码围栏行（` ``` ` 或 `~~~`，可带缩进）。 */
const CODE_FENCE = /^\s*(`{3,}|~{3,})/;

/** 条目自描述的两个键（都在第 0 列）。缺任何一个都不是条目块。 */
const ID_KEY = /^id:/;
const TYPE_KEY = /^type:/;

/**
 * 找 frontmatter 结束行时最多看多少行。
 *
 * @remarks
 * 没有这个上限时，"这个 `---` 是不是块首"就要扫到全文 —— 一段普通散文里的
 * `---`（分隔线）会让扫描退化成 O(n²)。
 */
const MAX_FRONTMATTER_LINES = 200;

/** 回显原文时的字符上限。 */
const MAX_ECHO = 40;

/** `\r` 的码位 —— 行尾标记不属于内容（`\r\n` 是 Windows 换行）。 */
const CARRIAGE_RETURN = 13;

/** 原文里的一行。`end` 是**内容**结束偏移（不含换行符），用于逐字节切片。 */
interface Line {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

/**
 * 把 AI 粘贴来的文本切成条目块（**纯函数**，不碰文件系统）。
 *
 * @remarks
 * 契约见 ADR-0012 —— **边界是自描述的 frontmatter，不是人为分隔符**：
 *
 * - 块首 = 一行独占的 `---`，且它到下一个 `---` 之间含 `id:` 与 `type:`；
 * - 路径**派生**：`EntryKindDir[type] + "/" + id + ".md"`（不读工作区，保持纯净）；
 * - 块外散文（开场白 / 围栏 / 合规说明表 / 追问）**天然跳过** —— 那是这项变更的收益；
 * - 不合法块**跳过并 warn**（Warning 级）；一个合法块都没有才整批拒收（Error 级）；
 * - `===== FILE:` / `===== END FILE` 保留为可选冗余：在的时候**定界**，
 *   声明的路径与 frontmatter 不一致时以 frontmatter 为准并 warn。
 * - **不猜**：既没标记、也没外层围栏、后面又没跟下一个条目的那一块，
 *   块尾只能到原文末尾 —— 尾随散文在那里与正文**无法区分**，工具不猜
 *   （落盘后由 `collab validate` 与人兜底）。
 *
 * 它住在 infrastructure 而不是 domain：read frontmatter 是**边界**的活
 * （`patterns/parse-dont-validate`：边界解析，领域只收类型化数据），
 * 而 `yaml` 这种外部包不许进 domain（ESLint 分层）。
 *
 * @param text - 粘贴来的原文（可能含 AI 的开场白、代码围栏、协议示例、说明表）
 * @returns 成功返回全部块 + warning；一个合法块都没有时返回全部 Issue
 */
export function parseCollabText(
  text: string,
): Result<ParsedText, readonly Issue[]> {
  const lines = splitLines(text);
  const files: ParsedFile[] = [];
  const warnings: Issue[] = [];
  /** 派生路径 → 它在 `files` 里的下标（重复路径要"保留最后一个"）。 */
  const seen = new Map<string, number>();

  let cursor = 0;
  while (cursor < lines.length) {
    const line = lines[cursor];
    if (line === undefined) break;

    if (END_MARKER.test(line.text)) {
      cursor += 1;
      continue;
    }

    const marker = FILE_MARKER.exec(line.text);
    if (marker !== null) {
      // 标记仍然定界（ADR-0012 二：它只是提示，但提示比散文精确）
      const chunkEnd = nextMarker(lines, cursor + 1);
      takeChunk(
        { lines, text, files, warnings, seen },
        cursor + 1,
        chunkEnd,
        marker[1] ?? "",
      );
      cursor = chunkEnd;
      continue;
    }

    if (isDocumentStart(lines, cursor, lines.length)) {
      const chunkEnd = nextBoundary(lines, cursor + 1);
      takeChunk({ lines, text, files, warnings, seen }, cursor, chunkEnd, null);
      cursor = chunkEnd;
      continue;
    }

    // 块外散文：天然跳过（开场白 / 围栏 / 说明表 / 追问都在这里消失）
    cursor += 1;
  }

  if (files.length === 0) {
    return Err([
      ...warnings,
      ParseIssues.invalid(
        "no entry block found — expected a YAML frontmatter block (`---` … `---`) with `id` and `type`",
      ),
    ]);
  }
  return Ok({ files, warnings });
}

/** 一次切分要用的全部状态（避免把 5 个可变数组塞进参数表）。 */
interface Scanner {
  readonly lines: readonly Line[];
  readonly text: string;
  readonly files: ParsedFile[];
  readonly warnings: Issue[];
  readonly seen: Map<string, number>;
}

/**
 * 处理一段候选区域。
 *
 * @param from - 区域起始行（含）
 * @param to - 区域结束行（不含）
 * @param markerPath - 区域所属的 `===== FILE:` 声明路径；`null` = 没标记
 */
function takeChunk(
  scanner: Scanner,
  from: number,
  to: number,
  markerPath: string | null,
): void {
  const { lines, text, files, warnings, seen } = scanner;
  const start = findDocumentStart(lines, from, to);

  if (start === null) {
    // 有标记却读不出条目 = 块状的东西被丢掉了，必须说（协议示例块就走这条）
    if (markerPath !== null && hasContent(lines, from, to)) {
      warnings.push(
        ParseIssues.skipped(
          "block has no YAML frontmatter (`---` … `---`)",
          snippet(lines, from, to),
        ),
      );
    }
    return;
  }

  const first = lines[start];
  const end = blockEnd(lines, start, to);
  const last = lines[end - 1];
  if (first === undefined || last === undefined) return;
  const content = text.slice(first.start, last.end);

  const doc = parseDocument(content);
  if (!doc.ok) {
    warnings.push(
      ParseIssues.skipped(
        describeDocumentError(doc.error),
        snippet(lines, from, to),
      ),
    );
    return;
  }

  const raw = doc.value.frontmatterRaw;
  const id = isRecord(raw) ? raw["id"] : undefined;
  const type = isRecord(raw) ? raw["type"] : undefined;

  if (typeof id !== "string" || id.length === 0) {
    warnings.push(
      ParseIssues.skipped("frontmatter has no usable `id`", snippet(lines, from, to)),
    );
    return;
  }
  if (typeof type !== "string" || !isEntryKind(type)) {
    warnings.push(
      ParseIssues.skipped(
        `type ${describe(type)} is not a known entry kind`,
        snippet(lines, from, to),
      ),
    );
    return;
  }

  const kind: EntryKind = type;
  const derived = `${EntryKindDir[kind]}/${id}.md`;

  if (doc.value.body.trim().length === 0) {
    warnings.push(ParseIssues.emptyBlock(derived));
    return;
  }

  if (markerPath !== null && !samePath(markerPath, derived)) {
    warnings.push(ParseIssues.pathMismatch(markerPath, derived));
  }

  const duplicate = seen.get(derived);
  if (duplicate !== undefined) {
    // 「修订版我又写了一遍」是常见形态 —— 硬拒会让整批作废（ADR-0012 四）
    warnings.push(ParseIssues.duplicatePath(derived));
    files[duplicate] = { path: derived, content };
    return;
  }

  seen.set(derived, files.length);
  files.push({ path: derived, content });
}

/**
 * 块尾：`to`，但条目被 AI 的代码围栏包住时收缩到那层围栏的**闭合行**。
 *
 * @remarks
 * 对话式 AI 常把整批条目塞进一个 ` ```text ` 围栏里，并且**不写** `===== END FILE`。
 * 只看 frontmatter 的话，最后一个条目会一路吃到围栏、说明表和结尾追问 ——
 * 那是**静默污染**（内容看起来是对的，只是多了一截）。
 *
 * 判据刻意保守：只有"块首本身在围栏内"（块首之前的围栏行数为奇数）才启用，
 * 且取 `to` 之前的**最后**一条围栏行。因此**没有外层围栏**的输入
 * （含正文里的 ```ts 代码块）永远走不到这条规则 —— 正文里的围栏不会截断条目。
 *
 * @param start - 块首行
 * @param to - 候选块尾（不含）
 */
function blockEnd(lines: readonly Line[], start: number, to: number): number {
  if (!inCodeFence(lines, start)) return to;
  const close = lastFenceBefore(lines, start + 1, to);
  return close ?? to;
}

/** `index` 这一行在代码围栏里吗（之前的围栏行数为奇数）。 */
function inCodeFence(lines: readonly Line[], index: number): boolean {
  let inside = false;
  for (let i = 0; i < index; i++) {
    const line = lines[i];
    if (line !== undefined && CODE_FENCE.test(line.text)) inside = !inside;
  }
  return inside;
}

/** `[from, to)` 里最后一条围栏行。 */
function lastFenceBefore(
  lines: readonly Line[],
  from: number,
  to: number,
): number | null {
  let found: number | null = null;
  for (let i = from; i < to; i++) {
    const line = lines[i];
    if (line !== undefined && CODE_FENCE.test(line.text)) found = i;
  }
  return found;
}

/**
 * 在 `[from, to)` 里找"条目块首"。
 *
 * @param from - 起始行（含）
 * @param to - 结束行（不含）
 * @returns 块首行号；找不到返回 `null`
 */
function findDocumentStart(
  lines: readonly Line[],
  from: number,
  to: number,
): number | null {
  for (let i = from; i < to; i++) {
    if (isDocumentStart(lines, i, to)) return i;
  }
  return null;
}

/**
 * 一行是不是条目块首 —— `---`，且到下一个 `---` 之间含 `id:` 与 `type:`。
 *
 * @remarks
 * 两个键都要求在**第 0 列**：正文里的 `---`（分隔线）与 `key: value` 散文
 * 因此不会被误判成块首。反过来也意味着**没有 id/type 的块识别不出来** ——
 * 那种输入靠 `===== FILE:` 标记定界（有标记时仍会跳过并 warn）。
 */
function isDocumentStart(
  lines: readonly Line[],
  index: number,
  limit: number,
): boolean {
  const head = lines[index];
  if (head === undefined || head.text !== FRONTMATTER_FENCE) return false;

  const stop = Math.min(index + MAX_FRONTMATTER_LINES, limit);
  let hasId = false;
  let hasType = false;
  for (let i = index + 1; i < stop; i++) {
    const line = lines[i];
    if (line === undefined) break;
    if (line.text === FRONTMATTER_FENCE) return hasId && hasType;
    if (ID_KEY.test(line.text)) hasId = true;
    if (TYPE_KEY.test(line.text)) hasType = true;
  }
  return false;
}

/** 下一个 `===== END FILE` / `===== FILE:` 行；没有则返回行数。 */
function nextMarker(lines: readonly Line[], from: number): number {
  for (let i = from; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) break;
    if (END_MARKER.test(line.text) || FILE_MARKER.test(line.text)) return i;
  }
  return lines.length;
}

/**
 * 无标记时的块尾：下一个标记、下一个块首，或原文末尾。
 *
 * @remarks
 * 这里**不把代码围栏当块尾**：条目正文里本来就可能含围栏（` ```ts ` 代码块），
 * 当终止符会静默截断内容。真实输入里条目自带 `===== FILE:` / `===== END FILE`，
 * 或由下一个条目的 frontmatter 定界。
 */
function nextBoundary(lines: readonly Line[], from: number): number {
  for (let i = from; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) break;
    if (END_MARKER.test(line.text) || FILE_MARKER.test(line.text)) return i;
    if (isDocumentStart(lines, i, lines.length)) return i;
  }
  return lines.length;
}

/** 区域里有没有非空白行。 */
function hasContent(lines: readonly Line[], from: number, to: number): boolean {
  for (let i = from; i < to; i++) {
    const line = lines[i];
    if (line !== undefined && line.text.trim().length > 0) return true;
  }
  return false;
}

/** 区域里第一行非空白内容（截断），用于让 warn 能对号入座。 */
function snippet(lines: readonly Line[], from: number, to: number): string {
  for (let i = from; i < to; i++) {
    const line = lines[i];
    if (line === undefined) break;
    const trimmed = line.text.trim();
    if (trimmed.length > 0) return truncate(trimmed);
  }
  return "";
}

function truncate(line: string): string {
  return line.length > MAX_ECHO ? `${line.slice(0, MAX_ECHO)}…` : line;
}

/**
 * 标记声明的路径与派生路径是否同一个。
 *
 * @remarks
 * 宽松比较：人写标记时会带 `COLLABORATION/` 前缀、`./`、反斜杠、大小写差异。
 * 这些是**形式差异**，不该报"不一致"（`patterns/lenient-parsing`）。
 */
function samePath(label: string, derived: string): boolean {
  return normalizeLabel(label) === normalizeLabel(derived);
}

function normalizeLabel(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^collaboration\//i, "")
    .toLowerCase();
}

/** 把文档解析错误翻成一句人能读的原因。 */
function describeDocumentError(error: DocumentParseError): string {
  switch (error.kind) {
    case "missing-frontmatter":
      return "block has no YAML frontmatter (`---` … `---`)";
    case "unclosed-frontmatter":
      return "frontmatter is not closed (missing trailing `---`)";
    case "invalid-yaml":
      return `frontmatter is not valid YAML: ${error.reason}`;
  }
}

/** YAML 映射的外形判据（不做 `as` 断言 —— 那是 lint 明令禁止的）。 */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 把 unknown 显示成人能读的样子。 */
function describe(value: unknown): string {
  if (typeof value === "string") return `"${value}"`;
  return JSON.stringify(value) ?? "(missing)";
}

/**
 * 按行切分，并记下每行在原文里的偏移。

 * @remarks
 * 不用 `split`/`join`：那样会把 CRLF 归一成 LF，`content` 就不再"与原文逐字节一致"。
 */
function splitLines(text: string): readonly Line[] {
  const lines: Line[] = [];
  let start = 0;
  while (start <= text.length) {
    const breakAt = text.indexOf("\n", start);
    const rawEnd = breakAt === -1 ? text.length : breakAt;
    // `\r\n` 的 `\r` 属于行尾标记，不属于内容
    const end =
      rawEnd > start && text.charCodeAt(rawEnd - 1) === CARRIAGE_RETURN
        ? rawEnd - 1
        : rawEnd;
    lines.push({ text: text.slice(start, end), start, end });
    if (breakAt === -1) break;
    start = breakAt + 1;
  }
  return lines;
}
