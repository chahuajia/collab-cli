import { type EntryKind, EntryKindValues } from "@/domain/entry/types";
import { refersToIdentity } from "@/domain/validation/resolvesRef";
import type { IndexEntry } from "@/application/extractIndexEntries";
import type { ParsedIndex, ParsedRow } from "@/cli/lib/parseIndex";

export interface RenderInput {
  readonly kind: EntryKind;
  readonly existing: ParsedIndex | null;
  /**
   * 目录里实际存在的条目。
   *
   * @remarks
   * 必须带 `fileName` —— 判断"已有行是否悬空"要用
   * `refersToIdentity`（与 `validate` 同一条规则），而它同时认短 id 与文件名。
   */
  readonly actualEntries: readonly IndexEntry[];
}

export interface RenderOutput {
  readonly content: string;
  readonly added: number;
  readonly removed: number;
}

interface IndexConfig {
  readonly title: string;
  readonly headerLines: readonly string[];
  readonly emptyColumnCount: number;
}

/**
 * 渲染 `_index.md` 内容。
 *
 * @remarks
 * 增量同步（D2=B）：
 * - 保留现有行（含人工列与异常行）。
 * - 删除悬空行 —— 判据必须与 `validate` 一致（`refersToIdentity`），
 *   否则会出现"validate 说合法、index 却删掉"的事故。
 * - 追加新行（只填 ID 列，其他留空）。
 *
 * 排序（D3=A）：数字 id 按数值，非数字 id 按字母，异常行排末尾。
 * 标题与表头：沿用 existing；若 existing 为空则用标准模板。
 */
export function renderIndex(input: RenderInput): RenderOutput {
  const { kind, existing, actualEntries } = input;
  const config = getIndexConfig(kind);

  let added = 0;
  let removed = 0;

  // 1. 保留的行
  const keptRows: ParsedRow[] = [];
  /** 已被保留行引用的条目 id —— 用来决定"还缺哪些行" */
  const referenced = new Set<string>();

  if (existing) {
    for (const row of existing.dataRows) {
      if (row.ref === null) {
        keptRows.push(row);
        continue;
      }
      const ref = row.ref;
      const matched = actualEntries.find((entry) =>
        refersToIdentity(ref, entry.id, entry.fileName),
      );
      if (matched === undefined) {
        removed++;
        continue;
      }
      keptRows.push(row);
      referenced.add(matched.id);
    }
  }

  // 2. 新行
  const newRows: ParsedRow[] = [];
  for (const entry of actualEntries) {
    if (!referenced.has(entry.id)) {
      newRows.push({
        raw: renderRow(kind, entry.id, config),
        ref: renderRef(kind, entry.id),
      });
      added++;
    }
  }

  // 3. 排序
  const sortedRows = sortRows([...keptRows, ...newRows]);

  // 4. 生成
  const lines: string[] = [];
  // existing 为 null → 新建 → 用默认标题
  // existing 存在 → 尊重现有 title（哪怕为空）
  const title = existing?.title?? config.title;
  if (title) {
    lines.push(`# ${title}`);
    lines.push("");
  }

  const headerLines = existing?.headerLines.length
    ? existing.headerLines
    : [...config.headerLines];
  lines.push(...headerLines);

  for (const row of sortedRows) {
    lines.push(row.raw);
  }

  if (existing?.extraContent) {
    lines.push("");
    lines.push(...existing.extraContent.split("\n"));
  }

  const content = lines.join("\n") + "\n";
  return { content, added, removed };
}

function renderRef(kind: EntryKind, id: string): string {
  return kind === EntryKindValues.Pattern ? `patterns/${id}` : id;
}

function renderRow(kind: EntryKind, id: string, config: IndexConfig): string {
  const ref = renderRef(kind, id);
  const link = `[[${ref}]]`;
  const empties = Array.from({ length: config.emptyColumnCount }, () => "");
  return `| ${[link, ...empties].join(" | ")} |`;
}

// ─────────────────────────────────────────────
// 排序
// ─────────────────────────────────────────────

type SortKey =
  | { kind: "numeric"; value: number }
  | { kind: "alphabetic"; value: string }
  | { kind: "abnormal"; value: number };

function sortRows(rows: readonly ParsedRow[]): ParsedRow[] {
  const keyed = rows.map((row, idx) => ({ row, key: sortKey(row.ref, idx) }));
  keyed.sort((a, b) => compareKeys(a.key, b.key));
  return keyed.map((x) => x.row);
}

function sortKey(ref: string | null, originalIndex: number): SortKey {
  if (ref === null) {
    return { kind: "abnormal", value: originalIndex };
  }
  const last = ref.includes("/") ? ref.split("/").pop() : ref;
  if (!last) return { kind: "abnormal", value: originalIndex };
  const m = last.match(/(\d+)$/);
  if (m && m[1]) {
    return { kind: "numeric", value: parseInt(m[1], 10) };
  }
  return { kind: "alphabetic", value: last };
}

function compareKeys(a: SortKey, b: SortKey): number {
  const order: Record<SortKey["kind"], number> = {
    numeric: 0,
    alphabetic: 1,
    abnormal: 2,
  };
  if (a.kind !== b.kind) return order[a.kind] - order[b.kind];

  if (a.kind === "numeric" && b.kind === "numeric") {
    return a.value - b.value;
  }
  if (a.kind === "alphabetic" && b.kind === "alphabetic") {
    return a.value.localeCompare(b.value);
  }
  if (a.kind === "abnormal" && b.kind === "abnormal") {
    return a.value - b.value;
  }
  return 0;
}

// ─────────────────────────────────────────────
// 类型配置
// ─────────────────────────────────────────────

function getIndexConfig(kind: EntryKind): IndexConfig {
  switch (kind) {
    case EntryKindValues.Skill:
      return {
        title: "技能索引",
        headerLines: [
          "| ID     | 名称 | 领域 | 状态   |",
          "| :----- | :- | :- | :--- |",
        ],
        emptyColumnCount: 3,
      };
    case EntryKindValues.Agreement:
      return {
        title: "约定索引",
        headerLines: [
          "| ID     | 名称             | 状态   |",
          "| :----- | :------------- | :----- |",
        ],
        emptyColumnCount: 2,
      };
    case EntryKindValues.Pattern:
      return {
        title: "模式索引",
        headerLines: ["| 模式 | 来源 | 用途 |", "| :- | :- | :- |"],
        emptyColumnCount: 2,
      };
    case EntryKindValues.Workflow:
      return {
        title: "工作流索引",
        headerLines: [
          "| ID     | 名称             | 触发场景   |",
          "| :----- | :------------- | :----- |",
        ],
        emptyColumnCount: 2,
      };
    case EntryKindValues.Adr:
      return {
        title: "ADR 索引",
        headerLines: [
          "| ID          | 标题             | 日期         | 状态       |",
          "| :---------- | :------------- | :--------- | :------- |",
        ],
        emptyColumnCount: 3,
      };
  }
}
