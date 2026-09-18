// src/domain/entry/__tests__/testHelpers.ts
import {Entry} from "@/domain/entry/Entry";
import {Frontmatter} from "@/domain/entry/Frontmatter";
import {EntryStatusValues, EntryKindValues} from "@/domain/entry/types";
import type {FrontmatterInput} from "@/domain/entry/FrontmatterInput";

/**
 * 构造测试用 Entry 的工厂。
 *
 * @remarks
 * 只应该在测试代码中使用。
 * 通过正规的工厂链条（FrontmatterInput → Frontmatter → Entry）构造，
 * 保证 fixture 与生产路径一致。
 */
export function makeEntry(
  overrides: {
    id?: string;
    type?: keyof typeof EntryKindValues;
    status?: keyof typeof EntryStatusValues;
    created?: string;
    updated?: string;
    body?: string;
    path?: string;
  } = {},
): Entry {
  const type = EntryKindValues[overrides.type ?? "Skill"];
  const input: FrontmatterInput = {
    id: overrides.id ?? "S12",
    type,
    status: EntryStatusValues[overrides.status ?? "Active"],
    created: overrides.created ?? "2026-09-11",
    updated: overrides.updated ?? "2026-09-11",
    domains: [],
    "applies-to": [],
    supersedes: null,
    author: "test@example.com",
    "co-authors": [],
    focus: [],
    provenance: undefined,
    falsifier: undefined,
    enforced: null,
  };
  const fmResult = Frontmatter.create(input);
  if (!fmResult.ok) {
    throw new Error(
      `makeEntry failed: ${fmResult.error.map((e) => e.message).join("; ")}`,
    );
  }
  return Entry.create(
    fmResult.value,
    overrides.body ?? "",
    overrides.path ?? "skills/S12.md",
  );
}