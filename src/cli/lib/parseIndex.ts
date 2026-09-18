/**
 * 从 `_index.md` 内容中解析出的单行数据。
 */
export interface ParsedRow {
  readonly raw: string;
  readonly ref: string | null;
}

/**
 * `_index.md` 的解析结果。
 *
 * @remarks
 * - `title`：`# xxx` 的标题文本，无标题为空串。
 * - `headerLines`：表头两行（含分隔行）。
 * - `dataRows`：数据行（含无法解析的异常行——D7=A）。
 * - `extraContent`：表格之外的额外内容（如 `## 变更规则`）。
 */
export interface ParsedIndex {
  readonly title: string;
  readonly headerLines: string[];
  readonly dataRows: ParsedRow[];
  readonly extraContent: string;
}

/**
 * 解析 `_index.md`。
 *
 * @remarks
 * 扫描规则：
 * - 标题：第一个匹配 `# xxx` 的行。
 * - 表头：第一个以 `|` 开头的行，及其后紧跟的分隔行（`| :-- |`）。
 * - 数据行：表头之后，直到遇到"空行 + 非 `|` 行"或文件末尾。
 * - 额外内容：数据行之后的所有内容，去掉前导空行。
 *
 * D7=A：无法识别的行按 `raw` 原样保留，`ref` 为 null。
 */
export function parseIndex(content: string): ParsedIndex {
  const lines = content.split(/\r?\n/);

  // 1. 标题
  let title = "";
  let cursor = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const m = line.match(/^#\s+(.+?)\s*$/);
    if (m && m[1]) {
      title = m[1];
      cursor = i + 1;
      break;
    }
    if (line.trim() !== "" && !line.startsWith("#")) break;
  }

  // 2. 表头
  let headerStart = -1;
  for (let i = cursor; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    if (line.startsWith("|")) {
      headerStart = i;
      break;
    }
  }

  if (headerStart === -1) {
    return { title, headerLines: [], dataRows: [], extraContent: "" };
  }

  const headerLines: string[] = [];
  const firstHeader = lines[headerStart];
  let dataStart = headerStart;

  // 第一行：表头
  if (firstHeader !== undefined) {
    headerLines.push(firstHeader);
    dataStart += 1;
  }

  // 第二行：分隔线
  const secondLine = lines[dataStart];
  if (
    secondLine !== undefined &&
    secondLine.startsWith("|") &&
    /^[\s|:\-]+$/.test(secondLine)
  ) {
    headerLines.push(secondLine);
    dataStart += 1;
  }

  // 3. 数据行
  const dataRows: ParsedRow[] = [];
  let dataEnd = dataStart;
  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;

    if (line === "") {
      const nextLine = lines[i + 1];
      if (nextLine === undefined) {
        dataEnd = i;
        break;
      }
      if (nextLine.startsWith("|")) {
        dataRows.push({ raw: "", ref: null });
        continue;
      }
      dataEnd = i;
      break;
    }

    dataRows.push({
      raw: line,
      ref: extractRef(line),
    });
    dataEnd = i + 1;
  }

  // 4. 额外内容
  const extraLines = lines.slice(dataEnd);
  while (extraLines.length > 0 && extraLines[0] === "") {
    extraLines.shift();
  }
  const extraContent = extraLines.join("\n").trimEnd();

  return { title, headerLines, dataRows, extraContent };
}

function extractRef(line: string): string | null {
  const m = line.match(/\[\[([^\]]+)\]\]/);
  return m && m[1] ? m[1] : null;
}
