import { describe, it, expect } from "vitest";
import { Issue } from "@/domain/validation/Issue";
import { ValidationReport } from "@/domain/validation/ValidationReport";
import { renderHumanReport, renderJsonReport } from "../renderReport.js";


const NO_COLOR = { useColor: false };
const WITH_COLOR = { useColor: true };

// ─────────────────────────────────────────────
// renderHumanReport
// ─────────────────────────────────────────────
describe("renderHumanReport", () => {
  describe("摘要行", () => {
    it("shows ✔ and entry count when no issues", () => {
      const report = ValidationReport.of([]);
      const out = renderHumanReport(report, 42, NO_COLOR);
      expect(out).toContain("✔");
      expect(out).toContain("42 entries");
      expect(out).toContain("0 issues");
    });

    it("shows ✖ when there are errors", () => {
      const report = ValidationReport.of([Issue.emptyId()]);
      const out = renderHumanReport(report, 1, NO_COLOR);
      expect(out).toContain("✖");
    });

    it("shows ⚠ when only warnings", () => {
      // TODO: 需要一个产生 warning severity 的 Issue 工厂
      // 目前所有工厂都产出 error。
      // 例如未来加 Issue.missingOptionalSection(...) 后启用此测试。
    });
  });

  describe("按文件分组", () => {
    it("groups issues by path", () => {
      const report = ValidationReport.of([
        Issue.missingFrontmatter("a.md"),
        Issue.missingFrontmatter("b.md"),
        Issue.invalidDate("bad"),
      ]);
      const out = renderHumanReport(report, 3, NO_COLOR);
      // a.md 和 b.md 各出现一次作为分组标题
      expect(out).toMatch(/a\.md/);
      expect(out).toMatch(/b\.md/);
    });

    it("shows severity prefix per issue", () => {
      const report = ValidationReport.of([Issue.emptyId()]);
      const out = renderHumanReport(report, 1, NO_COLOR);
      expect(out).toContain("[ERROR]");
    });

    it("shows code and message per issue", () => {
      const report = ValidationReport.of([Issue.emptyId()]);
      const out = renderHumanReport(report, 1, NO_COLOR);
      expect(out).toContain("EMPTY_ID");
      expect(out).toContain("entry id must not be empty");
    });

    it("shows suggestion when present", () => {
      const report = ValidationReport.of([Issue.invalidDate("2026-13-01")]);
      const out = renderHumanReport(report, 1, NO_COLOR);
      expect(out).toContain("→");
      expect(out).toContain("YYYY-MM-DD");
    });

    it("does not show → when no suggestion", () => {
      // emptyId 无 suggestion
      const report = ValidationReport.of([Issue.emptyId()]);
      const out = renderHumanReport(report, 1, NO_COLOR);
      out.split("\n").filter((l) => l.includes("EMPTY_ID"));
// 后续行（如果有）不应含 →
      const after = out.split("EMPTY_ID")[1] ?? "";
      const nextLine = after.split("\n")[1] ?? "";
      expect(nextLine).not.toContain("→");
    });

    it("handles issues without path (global)", () => {
      // 大部分 Issue 有 path，这里构造一个无 path 的场景
      const report = ValidationReport.of([Issue.emptyId()]);
      const out = renderHumanReport(report, 1, NO_COLOR);
      expect(out).toContain("EMPTY_ID");
    });
  });

  describe("汇总行", () => {
    it("shows error and warning counts at the end", () => {
      const report = ValidationReport.of([Issue.emptyId(), Issue.emptyId()]);
      const out = renderHumanReport(report, 2, NO_COLOR);
      expect(out).toContain("2 errors");
    });
  });

  describe("颜色（D2）", () => {
    it("uses ANSI codes when useColor=true", () => {
      const report = ValidationReport.of([Issue.emptyId()]);
      const out = renderHumanReport(report, 1, WITH_COLOR);
      expect(out).toContain("\x1b[");
    });

    it("does not use ANSI codes when useColor=false", () => {
      const report = ValidationReport.of([Issue.emptyId()]);
      const out = renderHumanReport(report, 1, NO_COLOR);
      expect(out).not.toContain("\x1b[");
    });
  });

  describe("无 Issue 场景（D7）", () => {
    it("shows ✔ and counts even with no issues", () => {
      const report = ValidationReport.of([]);
      const out = renderHumanReport(report, 10, NO_COLOR);
      expect(out).toContain("✔");
      expect(out).toContain("10 entries");
      expect(out).toContain("0 issues");
    });
  });
});

// ─────────────────────────────────────────────
// renderJsonReport
// ─────────────────────────────────────────────
describe("renderJsonReport", () => {
  it("produces valid JSON", () => {
    const report = ValidationReport.of([]);
    const out = renderJsonReport(report, 5);
    const parsed = JSON.parse(out);
    expect(parsed).toBeDefined();
  });

  it("includes entries count", () => {
    const report = ValidationReport.of([]);
    const parsed = JSON.parse(renderJsonReport(report, 5));
    expect(parsed.entries).toBe(5);
  });

  it("includes issues array", () => {
    const report = ValidationReport.of([Issue.emptyId()]);
    const parsed = JSON.parse(renderJsonReport(report, 1));
    expect(Array.isArray(parsed.issues)).toBe(true);
    expect(parsed.issues).toHaveLength(1);
  });

  it("includes summary with error and warning counts", () => {
    const report = ValidationReport.of([Issue.emptyId()]);
    const parsed = JSON.parse(renderJsonReport(report, 1));
    expect(parsed.summary.errors).toBe(1);
    expect(parsed.summary.warnings).toBe(0);
  });

  it("each issue has severity, code, message, path", () => {
    const report = ValidationReport.of([Issue.missingFrontmatter("a.md")]);
    const parsed = JSON.parse(renderJsonReport(report, 1));
    const issue = parsed.issues[0];
    expect(issue.severity).toBeDefined();
    expect(issue.code).toBeDefined();
    expect(issue.message).toBeDefined();
    expect(issue.path).toBe("a.md");
  });

  it("is parseable and ends with newline", () => {
    const report = ValidationReport.of([]);
    const out = renderJsonReport(report, 0);
    expect(out.endsWith("\n")).toBe(true);
    expect(() => JSON.parse(out)).not.toThrow();
  });
});
