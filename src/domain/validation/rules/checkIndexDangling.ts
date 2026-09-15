// src/domain/validation/rules/checkIndexDangling.ts

import { Issue } from "@/domain/validation/Issue";
import { resolvesRef } from "@/domain/validation/resolvesRef";
import {
  extractLinks,
  idPrefixForDir,
  lastSegmentOf,
} from "@/domain/validation/rules/_shared";
import type { RuleContext } from "@/domain/validation/Rule";

/**
 * 校验所有 `_index.md` 中的引用是否解析到已存在的实体。
 *
 * @remarks
 * - "解析"包括：短 id / 长路径 / 文件名（见 `resolvesRef`）。
 * - 跨目录引用不报（D5=B）—— 由 `linksResolve` 负责全量检查。
 * - `_` 开头视为元数据，跳过（D8=B）。
 */
export function checkIndexDangling(context: RuleContext): readonly Issue[] {
  const issues: Issue[] = [];

  for (const [dir, content] of context.indexFiles) {
    const refs = extractLinks(content);
    const seen = new Set<string>();
    const expectedPrefix = idPrefixForDir(dir);
    const indexPath = `${dir}/_index.md`;

    for (const ref of refs) {
      const key = lastSegmentOf(ref);
      if (seen.has(key)) continue;
      seen.add(key);

      // D8=B：`_` 开头视为元数据
      if (key.startsWith('_')) continue;

      // 能解析（短 id / 长路径 / 文件名）→ 不是 dangling
      if (resolvesRef(ref, context)) continue;

      // "看起来属于本目录" 才报
      if (expectedPrefix === undefined) continue;
      if (!ref.startsWith(expectedPrefix)) continue;

      issues.push(Issue.danglingIndexEntry(indexPath, ref));
    }
  }

  return issues;
}
