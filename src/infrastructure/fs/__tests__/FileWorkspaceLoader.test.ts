// src/infrastructure/fs/__tests__/FileWorkspaceLoader.test.ts
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { IssueCodeValues } from "@/domain/validation/IssueCode";
import { FileWorkspaceLoader } from "@/infrastructure/fs/FileWorkspaceLoader";

/** 测试用临时目录。每个用例独立创建/销毁。 */
let testRoot: string;
let collabDir: string;

beforeEach(async () => {
  testRoot = await mkdtemp(path.join(tmpdir(), "collab-loader-"));
  collabDir = path.join(testRoot, "COLLABORATION");
  await mkdir(collabDir, { recursive: true });
});

afterEach(async () => {
  await rm(testRoot, { recursive: true, force: true });
});

/** 写入一个文件，自动创建父目录。 */
async function writeFileAt(relPath: string, content: string): Promise<void> {
  const fullPath = path.join(collabDir, relPath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf8");
}

/** 一个合法的 frontmatter body。 */
function validFrontmatter(overrides: Record<string, string> = {}): string {
  const fields = {
    id: "S12",
    type: "skill",
    status: "active",
    created: "2026-09-11",
    updated: "2026-09-11",
    author: "test@example.com",
    ...overrides,
  };
  return Object.entries(fields)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

/** 一个完整的合法条目文件内容。 */
function validEntryFile(overrides: Record<string, string> = {}): string {
  return `---\n${validFrontmatter(overrides)}\n---\n\n## 上下文\n\n## 问题\n\n## 方案\n\n## 反面\n\n## 关联\n`;
}

describe("FileWorkspaceLoader", () => {
  // ─────────────────────────────────────────────
  // D1: 目录不存在 → 抛异常
  // ─────────────────────────────────────────────
  describe("D1: 目录不存在", () => {
    it("throws when COLLABORATION directory does not exist", () => {
      const loader = new FileWorkspaceLoader(
        path.join(testRoot, "nonexistent"),
      );
      expect(() => loader.load()).toThrow();
    });
  });

  // ─────────────────────────────────────────────
  // E2: 空目录 → 空 Workspace
  // ─────────────────────────────────────────────
  describe("E2: 空 workspace", () => {
    it("returns empty workspace when COLLABORATION is empty", () => {
      const loader = new FileWorkspaceLoader(collabDir);
      const ws = loader.load();
      expect(ws.entries).toHaveLength(0);
      expect(ws.indexFiles.size).toBe(0);
    });

    it("does not throw when some known dirs are missing (D2=A)", async () => {
      await writeFileAt("skills/S12.md", validEntryFile());
      const loader = new FileWorkspaceLoader(collabDir);
      const ws = loader.load();
      expect(ws.entries).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────
  // E3: 单条完美元目
  // ─────────────────────────────────────────────
  describe("E3: 完美元目", () => {
    it("loads a valid entry without issues", async () => {
      await writeFileAt("skills/S12.md", validEntryFile());
      const loader = new FileWorkspaceLoader(collabDir);
      const ws = loader.load();
      expect(ws.entries).toHaveLength(1);
      const loaded = ws.entries[0]!;
      expect(loaded.entry).not.toBeNull();
      expect(loaded.entry?.frontmatter.id).toBe("S12");
      expect(loaded.parseIssues).toHaveLength(0);
    });

    it("preserves the file path in the loaded entry", async () => {
      await writeFileAt("skills/S12.md", validEntryFile());
      const loader = new FileWorkspaceLoader(collabDir);
      const ws = loader.load();
      const loaded = ws.entries[0]!;
      const normalized = loaded.path.replace(/\\/g, "/");
      expect(normalized).toContain("skills/S12.md");
    });
  });

  // ─────────────────────────────────────────────
  // E4: 无 frontmatter
  // ─────────────────────────────────────────────
  describe("E4: 无 frontmatter", () => {
    it("reports missingFrontmatter", async () => {
      await writeFileAt("skills/S12.md", "## 上下文\n\n没有 frontmatter\n");
      const loader = new FileWorkspaceLoader(collabDir);
      const ws = loader.load();
      expect(ws.entries).toHaveLength(1);
      const loaded = ws.entries[0]!;
      expect(loaded.entry).toBeNull();
      expect(loaded.parseIssues[0]?.code).toBe(
        IssueCodeValues.MissingFrontmatter,
      );
    });

    it("reports missingFrontmatter for empty file (E13)", async () => {
      await writeFileAt("skills/S12.md", "");
      const loader = new FileWorkspaceLoader(collabDir);
      const ws = loader.load();
      expect(ws.entries[0]?.parseIssues[0]?.code).toBe(
        IssueCodeValues.MissingFrontmatter,
      );
    });

    it("reports missingFrontmatter when only body exists (E15)", async () => {
      await writeFileAt("skills/S12.md", "## 上下文\n\n只有 body\n");
      const loader = new FileWorkspaceLoader(collabDir);
      const ws = loader.load();
      expect(ws.entries[0]?.entry).toBeNull();
    });
  });

  // ─────────────────────────────────────────────
  // E5: YAML 语法错误
  // ─────────────────────────────────────────────
  describe("E5: YAML 语法错误", () => {
    it("reports invalidYaml", async () => {
      await writeFileAt("skills/S12.md", "---\nid: [unclosed\n---\n正文\n");
      const loader = new FileWorkspaceLoader(collabDir);
      const ws = loader.load();
      expect(ws.entries[0]?.entry).toBeNull();
      expect(ws.entries[0]?.parseIssues[0]?.code).toBe(
        IssueCodeValues.InvalidYaml,
      );
    });

    it("reports unclosed frontmatter as invalidYaml or unclosed", async () => {
      await writeFileAt("skills/S12.md", "---\nid: S12\n## no closing\n");
      const loader = new FileWorkspaceLoader(collabDir);
      const ws = loader.load();
      expect(ws.entries[0]?.entry).toBeNull();
    });
  });

  // ─────────────────────────────────────────────
  // E6: Frontmatter.create 失败
  // ─────────────────────────────────────────────
  describe("E6: 领域不变量失败", () => {
    it("reports dateOrderInvalid but keeps parseIssues", async () => {
      await writeFileAt(
        "skills/S12.md",
        validEntryFile({
          created: "2026-09-12",
          updated: "2026-09-11",
        }),
      );
      const loader = new FileWorkspaceLoader(collabDir);
      const ws = loader.load();
      expect(ws.entries[0]?.entry).toBeNull();
      const codes = ws.entries[0]?.parseIssues.map((i) => i.code) ?? [];
      expect(codes).toContain(IssueCodeValues.DateOrderInvalid);
    });

    it("reports idPrefixMismatch", async () => {
      await writeFileAt("skills/S12.md", validEntryFile({ id: "X12" }));
      const loader = new FileWorkspaceLoader(collabDir);
      const ws = loader.load();
      expect(ws.entries[0]?.entry).toBeNull();
      const codes = ws.entries[0]?.parseIssues.map((i) => i.code) ?? [];
      expect(codes).toContain(IssueCodeValues.IdPrefixMismatch);
    });

    it("collects multiple issues from one file", async () => {
      await writeFileAt(
        "skills/S12.md",
        validEntryFile({
          id: "X12",
          created: "2026-13-01",
        }),
      );
      const loader = new FileWorkspaceLoader(collabDir);
      const ws = loader.load();
      expect((ws.entries[0]?.parseIssues ?? []).length).toBeGreaterThanOrEqual(
        2,
      );
    });
  });

  // ─────────────────────────────────────────────
  // E7 / E8: _index.md 和 _template.md
  // ─────────────────────────────────────────────
  describe("E7 / E8: 特殊文件", () => {
    it("loads _index.md content into indexFiles", async () => {
      await writeFileAt("skills/S12.md", validEntryFile());
      await writeFileAt("skills/_index.md", "| [[S12]] |");
      const loader = new FileWorkspaceLoader(collabDir);
      const ws = loader.load();
      expect(ws.indexFiles.get("skills")).toBe("| [[S12]] |");
    });

    it("does not create an entry for _index.md", async () => {
      await writeFileAt("skills/_index.md", "| content |");
      const loader = new FileWorkspaceLoader(collabDir);
      const ws = loader.load();
      expect(ws.entries).toHaveLength(0);
    });

    it("skips _template.md (E8)", async () => {
      await writeFileAt("skills/_template.md", "---\nid: S0\n---\n");
      const loader = new FileWorkspaceLoader(collabDir);
      const ws = loader.load();
      expect(ws.entries).toHaveLength(0);
      expect(ws.indexFiles.has("skills")).toBe(false);
    });

    it("handles nested _index.md (meta/decision-records)", async () => {
      await writeFileAt("meta/decision-records/_index.md", "| [[ADR-0001]] |");
      const loader = new FileWorkspaceLoader(collabDir);
      const ws = loader.load();
      expect(ws.indexFiles.get("meta/decision-records")).toBe(
        "| [[ADR-0001]] |",
      );
    });
  });

  // ─────────────────────────────────────────────
  // E9 / E11: 未知目录 / 非 .md 文件
  // ─────────────────────────────────────────────
  describe("E9 / E11: 边界", () => {
    it("skips unknown directories (E9)", async () => {
      await writeFileAt("drafts/S12.md", validEntryFile());
      const loader = new FileWorkspaceLoader(collabDir);
      const ws = loader.load();
      expect(ws.entries).toHaveLength(0);
    });

    it("skips non-markdown files (E11)", async () => {
      await writeFileAt("skills/notes.txt", "some text");
      const loader = new FileWorkspaceLoader(collabDir);
      const ws = loader.load();
      expect(ws.entries).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────
  // E10: Windows 换行
  // ─────────────────────────────────────────────
  describe("E10: Windows 换行", () => {
    it("parses files with \\r\\n line endings", async () => {
      const content = validEntryFile().replace(/\n/g, "\r\n");
      await writeFileAt("skills/S12.md", content);
      const loader = new FileWorkspaceLoader(collabDir);
      const ws = loader.load();
      expect(ws.entries[0]?.entry).not.toBeNull();
      expect(ws.entries[0]?.entry?.frontmatter.id).toBe("S12");
    });
  });

  // ─────────────────────────────────────────────
  // E12: 递归扫描
  // ─────────────────────────────────────────────
  describe("E12: 递归扫描", () => {
    it("finds entries in subdirectories", async () => {
      await writeFileAt("skills/advanced/S12.md", validEntryFile());
      const loader = new FileWorkspaceLoader(collabDir);
      const ws = loader.load();
      expect(ws.entries).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────
  // D8: 遍历顺序
  // ─────────────────────────────────────────────
  describe("D8: 遍历顺序", () => {
    it("traverses known directories in EntryKindDir order", async () => {
      await writeFileAt("skills/S12.md", validEntryFile({ id: "S12" }));
      await writeFileAt(
        "agreements/A1.md",
        validEntryFile({
          id: "A1",
          type: "agreement",
        }),
      );
      await writeFileAt(
        "workflows/W1.md",
        validEntryFile({
          id: "W1",
          type: "workflow",
        }),
      );
      const loader = new FileWorkspaceLoader(collabDir);
      const ws = loader.load();

      const ids = ws.entries
        .map((e) => e.entry?.frontmatter.id)
        .filter((x): x is NonNullable<typeof x> => x !== undefined)
        .map((id) => String(id));
      const agreementsIdx = ids.indexOf("A1");
      const workflowsIdx = ids.indexOf("W1");
      const skillsIdx = ids.indexOf("S12");
      expect(agreementsIdx).toBeLessThan(workflowsIdx);
      expect(workflowsIdx).toBeLessThan(skillsIdx);
    });

    it("sorts files alphabetically within a directory", async () => {
      await writeFileAt("skills/S12.md", validEntryFile({ id: "S12" }));
      await writeFileAt("skills/S11.md", validEntryFile({ id: "S11" }));
      await writeFileAt("skills/S13.md", validEntryFile({ id: "S13" }));
      const loader = new FileWorkspaceLoader(collabDir);
      const ws = loader.load();
      const ids = ws.entries
        .map((e) => e.entry?.frontmatter.id)
        .filter((x): x is NonNullable<typeof x> => x !== undefined);
      // 按文件名 S11.md, S12.md, S13.md 排序
      expect(ids).toEqual(["S11", "S12", "S13"]);
    });
  });

  // ─────────────────────────────────────────────
  // E14: 只有 frontmatter 无 body
  // ─────────────────────────────────────────────
  describe("E14: 无 body", () => {
    it("sets body to empty string", async () => {
      const content = `---\n${validFrontmatter()}\n---\n`;
      await writeFileAt("skills/S12.md", content);
      const loader = new FileWorkspaceLoader(collabDir);
      const ws = loader.load();
      expect(ws.entries[0]?.entry?.body).toBe("");
    });
  });

  // ─────────────────────────────────────────────
  // allMarkdownPaths（新增）
  // ─────────────────────────────────────────────
  describe("allMarkdownPaths", () => {
    it("collects all .md paths including entry files", async () => {
      await writeFileAt("skills/S1.md", validEntryFile({ id: "S1" }));
      await writeFileAt("skills/S2.md", validEntryFile({ id: "S2" }));

      const loader = new FileWorkspaceLoader(collabDir);
      const ws = loader.load();

      expect(ws.allMarkdownPaths.has("skills/S1")).toBe(true);
      expect(ws.allMarkdownPaths.has("skills/S2")).toBe(true);
    });

    it("collects _index.md paths", async () => {
      await writeFileAt("skills/_index.md", "# 索引\n");

      const loader = new FileWorkspaceLoader(collabDir);
      const ws = loader.load();

      expect(ws.allMarkdownPaths.has("skills/_index")).toBe(true);
    });

    it("collects .md paths OUTSIDE entry directories (ROOT, meta)", async () => {
      await writeFileAt("ROOT.md", "# 根\n");
      await writeFileAt("meta/evolution-log.md", "# 日志\n");
      await writeFileAt("meta/pruning-policy.md", "# 策略\n");
      await writeFileAt("README.md", "# 说明\n");

      const loader = new FileWorkspaceLoader(collabDir);
      const ws = loader.load();

      expect(ws.allMarkdownPaths.has("ROOT")).toBe(true);
      expect(ws.allMarkdownPaths.has("meta/evolution-log")).toBe(true);
      expect(ws.allMarkdownPaths.has("meta/pruning-policy")).toBe(true);
      expect(ws.allMarkdownPaths.has("README")).toBe(true);
    });

    it("strips .md suffix from paths", async () => {
      await writeFileAt("skills/S1.md", validEntryFile({ id: "S1" }));

      const loader = new FileWorkspaceLoader(collabDir);
      const ws = loader.load();

      // 有 "skills/S1"，但没有 "skills/S1.md"
      expect(ws.allMarkdownPaths.has("skills/S1")).toBe(true);
      expect(ws.allMarkdownPaths.has("skills/S1.md")).toBe(false);
    });

    it("ignores non-.md files", async () => {
      await writeFileAt("skills/notes.txt", "x");
      await writeFileAt("skills/config.json", "{}");

      const loader = new FileWorkspaceLoader(collabDir);
      const ws = loader.load();

      // 只有 .md 被收集
      expect(ws.allMarkdownPaths.size).toBe(0);
    });

    it("collects nested .md paths", async () => {
      await writeFileAt(
        "meta/decision-records/ADR-0001.md",
        "---\nid: ADR-0001\n",
      );
      await writeFileAt(
        "skills/advanced/S12.md",
        validEntryFile({ id: "S12" }),
      );

      const loader = new FileWorkspaceLoader(collabDir);
      const ws = loader.load();

      expect(ws.allMarkdownPaths.has("meta/decision-records/ADR-0001")).toBe(
        true,
      );
      expect(ws.allMarkdownPaths.has("skills/advanced/S12")).toBe(true);
    });
  });
})
