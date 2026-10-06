import { describe, expect, it } from "vitest";
import { makeEntry } from "@/domain/entry/__tests__/testHelpers";
import { IssueCodeValues } from "@/domain/validation/IssueCode";
import { relationsNotLinked } from "@/domain/validation/rules/relationsNotLinked";
import { SeverityValues } from "@/domain/validation/Severity";
import type { Entry } from "@/domain/entry/Entry";
import type { RuleContext } from "@/domain/validation/Rule";

/**
 * 「关联」节必须是 `[[双链]]`。
 *
 * @remarks
 * 事故（2026-10-06）：某项目由 agent 落盘的三条条目，「## 关联」里写的是
 * `patterns/characterization-first-refactor.md`、`agreements/A1-layer-ownership.md` 这种**裸路径**。
 * `linksResolve` 看不见它们（**那根本不是链接**），可达性与 `catalog` 的图各少一条边。
 *
 * **它不查什么**（免得"CI 绿"被读成"关联都对"）：
 * 不查"该关联的有没有关联"（那要人判断），只查"写下的关联是不是合法链接"。
 */
function ctx(entries: readonly Entry[]): RuleContext {
  return {
    allEntries: entries,
    allEntryIds: new Set(entries.map((e) => e.frontmatter.id)),
    indexFiles: new Map(),
    allMarkdownPaths: new Set(entries.map((e) => e.path)),
  };
}

const TARGET = makeEntry({
  id: "characterization-first-refactor",
  type: "Pattern",
  path: "patterns/characterization-first-refactor.md",
});

const SUBJECT = makeEntry({
  id: "A1-layer-ownership",
  type: "Agreement",
  path: "agreements/A1-layer-ownership.md",
});

function subjectWithBody(body: string): Entry {
  return makeEntry({
    id: "A1-layer-ownership",
    type: "Agreement",
    path: "agreements/A1-layer-ownership.md",
    body,
  });
}

describe("relationsNotLinked", () => {
  it("关联节里的裸路径（带 .md）→ 报错，并建议写成目标 id", () => {
    const issues = relationsNotLinked(
      subjectWithBody("## 方案\n\nx\n\n## 关联\n\npatterns/characterization-first-refactor.md\n"),
      ctx([TARGET, SUBJECT]),
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe(IssueCodeValues.RelationsNotLinked);
    expect(issues[0]?.severity).toBe(SeverityValues.Error);
    expect(issues[0]?.suggestion).toContain("characterization-first-refactor");
  });

  it("关联节里的裸路径（不带 .md）同样报", () => {
    const issues = relationsNotLinked(
      subjectWithBody("## 关联\n\npatterns/characterization-first-refactor\n"),
      ctx([TARGET, SUBJECT]),
    );
    expect(issues).toHaveLength(1);
  });

  it("写成 [[双链]] → 不报", () => {
    const issues = relationsNotLinked(
      subjectWithBody("## 关联\n\n[[characterization-first-refactor]]\n"),
      ctx([TARGET, SUBJECT]),
    );
    expect(issues).toEqual([]);
  });

  it("**范围即判据**：同样的裸路径出现在别的节 → 不报（本库正文到处这么写）", () => {
    const issues = relationsNotLinked(
      subjectWithBody(
        "## 方案\n\n沿用 patterns/characterization-first-refactor.md 的做法。\n\n## 关联\n\n[[characterization-first-refactor]]\n",
      ),
      ctx([TARGET, SUBJECT]),
    );
    expect(issues).toEqual([]);
  });

  it("解析不到的 token 不算「漏写的链接」（那多半是散文 / 外部路径）", () => {
    const issues = relationsNotLinked(
      subjectWithBody("## 关联\n\npatterns/no-such-entry.md\nsrc/foo.ts\n"),
      ctx([TARGET, SUBJECT]),
    );
    expect(issues).toEqual([]);
  });

  it("同一个裸引用出现多次只报一次", () => {
    const issues = relationsNotLinked(
      subjectWithBody(
        "## 关联\n\npatterns/characterization-first-refactor.md、patterns/characterization-first-refactor.md\n",
      ),
      ctx([TARGET, SUBJECT]),
    );
    expect(issues).toHaveLength(1);
  });
});
