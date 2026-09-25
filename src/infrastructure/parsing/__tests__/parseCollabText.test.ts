import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { IssueCodeValues } from "@/domain/validation/IssueCode";
import { SeverityValues } from "@/domain/validation/Severity";
import { parseCollabText } from "@/infrastructure/parsing/parseCollabText";
import type { Issue } from "@/domain/validation/Issue";
import type { ParsedText } from "@/infrastructure/parsing/parseCollabText";
import type { Result } from "@/shared/Result";

/**
 * **真产物**：对话式 AI 的实际输出（CRLF，原样入库，见 `.gitattributes`）。
 *
 * @remarks
 * 它曾经只存在于仓外（`D:\下载缓存\test.txt`）—— 那份验收标准无法被下一个人重跑
 * （KB `patterns/reproducible-verification`：能写成检查的，就别留成"我试过"）。
 */
const FIXTURE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "real-ai-output.txt",
);

/**
 * 一条**自描述**的条目 —— id 与 type 在 frontmatter 里，路径由它们派生（ADR-0012）。
 */
function entry(id: string, type: string, body = "## 上下文\n\n正文"): string {
  return [
    "---",
    `id: ${id}`,
    `type: ${type}`,
    "status: draft",
    "created: 2026-09-26",
    "updated: 2026-09-26",
    "author: heiniao",
    `aliases: [${id}]`,
    "enforced: null",
    "---",
    "",
    body,
  ].join("\n");
}

/** `===== FILE:` 只是**可选冗余**（人能读）；它与 END 一起定界，但不定路径。 */
function block(path: string, content: string): string {
  return `===== FILE: ${path} =====\n${content}\n===== END FILE =====`;
}

function ok(
  result: Result<ParsedText, readonly Issue[]>,
): ParsedText {
  if (!result.ok) {
    throw new Error(result.error.map((i) => i.format()).join(" | "));
  }
  return result.value;
}

function err(
  result: Result<ParsedText, readonly Issue[]>,
): readonly Issue[] {
  if (result.ok) throw new Error("expected Err");
  return result.error;
}

function codes(issues: readonly Issue[]): readonly string[] {
  return issues.map((i) => i.code);
}

describe("parseCollabText", () => {
  describe("边界 = 自描述 frontmatter（ADR-0012）", () => {
    it("路径由 type + id 派生，内容与原文逐字节一致", () => {
      const content = entry("S1", "skill");
      const parsed = ok(parseCollabText(block("skills/S1.md", content)));

      expect(parsed.files).toEqual([{ path: "skills/S1.md", content }]);
      expect(parsed.warnings).toEqual([]);
    });

    it("每种 type 派生到自己目录（含 meta/decision-records）", () => {
      const text = [
        entry("lenient-parsing", "pattern"),
        entry("ADR-0012", "adr"),
        entry("A10", "agreement"),
        entry("chatgpt-output-format", "integration"),
      ].join("\n");

      expect(ok(parseCollabText(text)).files.map((f) => f.path)).toEqual([
        "patterns/lenient-parsing.md",
        "meta/decision-records/ADR-0012.md",
        "agreements/A10.md",
        "integrations/chatgpt-output-format.md",
      ]);
    });

    it("没有标记也能切分（frontmatter 才是契约）", () => {
      const text = [entry("S1", "skill"), entry("S2", "skill")].join("\n");
      const parsed = ok(parseCollabText(text));
      expect(parsed.files.map((f) => f.path)).toEqual([
        "skills/S1.md",
        "skills/S2.md",
      ]);
      expect(parsed.files[0]?.content.startsWith("---\nid: S1")).toBe(true);
    });

    it("保留 CRLF —— 不把行尾归一化（逐字节一致）", () => {
      const content = entry("S1", "skill").replace(/\n/g, "\r\n");
      const parsed = ok(parseCollabText(block("skills/S1.md", content)));
      expect(parsed.files[0]?.content).toBe(content);
    });

    it("正文里的 `---` 分隔线不会被当成下一个块首", () => {
      const body = "## 方案\n\n---\n\n分隔线以上是同一节。";
      const content = entry("S1", "skill", body);
      const parsed = ok(parseCollabText(block("skills/S1.md", content)));
      expect(parsed.files[0]?.content).toBe(content);
    });
  });

  describe("三种污染（真实 AI 输出）", () => {
    it("真产物（仓内夹具，原样）：一条条目，内容 = 原文去掉包装行", () => {
      const fixture = readFileSync(FIXTURE, "utf8");
      const parsed = ok(parseCollabText(fixture));

      expect(parsed.files).toHaveLength(1);
      expect(parsed.files[0]?.path).toBe("patterns/lenient-parsing.md");
      expect(parsed.warnings).toEqual([]);

      // 期望值**换一套机制**算：整体正则剥壳（解析器是逐行扫描）—— 不是同义反复
      const expected = fixture
        .replace(/^===== FILE:[^\n]*\r?\n/, "")
        .replace(/\r?\n===== END FILE =====\r?\n?$/, "");
      const content = parsed.files[0]?.content ?? "";
      expect(content).toBe(expected);

      // 行尾**不归一化**：文件是 CRLF，内容就该是 CRLF（与 git 的换行策略无关）
      expect(content.includes("\r\n")).toBe(fixture.includes("\r\n"));
      // 包装行不进内容
      expect(content).not.toContain("===== FILE:");
      expect(content).not.toContain("END FILE");
    });

    it("开场白：跳过且不报错", () => {
      const text = `好的，我按约定的格式输出这几条：\n\n${block("skills/S1.md", entry("S1", "skill"))}`;
      const parsed = ok(parseCollabText(text));
      expect(parsed.files.map((f) => f.path)).toEqual(["skills/S1.md"]);
    });

    it("代码围栏包裹：跳过且不报错", () => {
      const text = [
        "开场白……",
        "```text",
        block("skills/S1.md", entry("S1", "skill")),
        "```",
        "以上就是全部。",
      ].join("\n");
      const parsed = ok(parseCollabText(text));
      expect(parsed.files.map((f) => f.path)).toEqual(["skills/S1.md"]);
    });

    it("合规说明表 + 追问：只取条目", () => {
      const text = [
        block("skills/S1.md", entry("S1", "skill")),
        "",
        "| 项 | 结果 |",
        "| :-- | :-- |",
        "| falsifier 已填 | 是 |",
        "",
        "要不要我再补一条反面？",
      ].join("\n");
      const parsed = ok(parseCollabText(text));
      expect(parsed.files).toHaveLength(1);
      expect(parsed.files[0]?.content).toBe(entry("S1", "skill"));
    });

    it("围栏包住整批 + 漏写 END FILE：最后一个条目不被围栏/说明表污染", () => {
      const body = entry("S1", "skill");
      const text = [
        "好的：",
        "```text",
        body,
        "```",
        "| 项 | 结果 |",
        "| :-- | :-- |",
        "| 已入库 | 是 |",
        "",
        "要不要我再补一条？",
      ].join("\n");

      const parsed = ok(parseCollabText(text));
      expect(parsed.files).toEqual([{ path: "skills/S1.md", content: body }]);
      expect(parsed.warnings).toEqual([]);
    });

    it("正文里的代码围栏不会截断条目（正文围栏 ≠ 块尾）", () => {
      const body = entry(
        "S1",
        "skill",
        ["## 方案", "", "```ts", "const x = 1;", "```", "", "以上是代码。", "", "## 反面", "", "别这样。"].join("\n"),
      );
      const parsed = ok(parseCollabText(block("skills/S1.md", body)));
      expect(parsed.files[0]?.content).toBe(body);
    });
  });

  describe("宽容 ≠ 静默（跳过 → Warning）", () => {
    it("协议示例块（有标记、无 frontmatter）被跳过并 warn", () => {
      const text = [
        block("<相对路径>", "<完整内容>"),
        block("skills/S1.md", entry("S1", "skill")),
      ].join("\n");

      const parsed = ok(parseCollabText(text));
      expect(parsed.files.map((f) => f.path)).toEqual(["skills/S1.md"]);
      expect(codes(parsed.warnings)).toEqual([IssueCodeValues.ParseSkippedBlock]);
      expect(parsed.warnings[0]?.message).toContain("frontmatter");
    });

    it("type 不认识 → 跳过该块，其余照收", () => {
      const text = [
        entry("S1", "skill"),
        entry("x", "not-a-kind"),
      ].join("\n");

      const parsed = ok(parseCollabText(text));
      expect(parsed.files.map((f) => f.path)).toEqual(["skills/S1.md"]);
      expect(codes(parsed.warnings)).toEqual([IssueCodeValues.ParseSkippedBlock]);
      expect(parsed.warnings[0]?.message).toContain("not-a-kind");
    });

    it("缺 id → 跳过该块", () => {
      const withoutId = [
        "---",
        "type: skill",
        "status: draft",
        "---",
        "",
        "正文",
      ].join("\n");

      // 一个合法块都没有 → Err；Err 里仍带着"为什么跳过"（warning 不被丢掉）
      expect(codes(err(parseCollabText(block("skills/S9.md", withoutId))))).toEqual([
        IssueCodeValues.ParseSkippedBlock,
        IssueCodeValues.ParseInvalid,
      ]);
    });

    it("空正文 → ParseEmptyBlock（Warning，不阻断整批）", () => {
      const text = [
        entry("S1", "skill"),
        entry("S2", "skill", ""),
      ].join("\n");

      const parsed = ok(parseCollabText(text));
      expect(parsed.files.map((f) => f.path)).toEqual(["skills/S1.md"]);
      expect(codes(parsed.warnings)).toEqual([IssueCodeValues.ParseEmptyBlock]);
      expect(parsed.warnings[0]?.severity).toBe(SeverityValues.Warning);
    });

    it("重复的派生路径 → 保留最后一个 + warn", () => {
      const text = [
        block("skills/S1.md", entry("S1", "skill", "## 上下文\n\n旧版")),
        block("skills/S1.md", entry("S1", "skill", "## 上下文\n\n新版")),
      ].join("\n");

      const parsed = ok(parseCollabText(text));
      expect(parsed.files).toHaveLength(1);
      expect(parsed.files[0]?.content).toContain("新版");
      expect(codes(parsed.warnings)).toEqual([IssueCodeValues.ParseDuplicatePath]);
    });
  });

  describe("`===== FILE:` 只是提示（ADR-0012 二）", () => {
    it("与 frontmatter 一致时不报（前缀 / 反斜杠 / 大小写都算一致）", () => {
      const parsed = ok(
        parseCollabText(block("COLLABORATION\\Skills\\S1.md", entry("S1", "skill"))),
      );
      expect(parsed.files.map((f) => f.path)).toEqual(["skills/S1.md"]);
      expect(parsed.warnings).toEqual([]);
    });

    it("不一致时以 frontmatter 为准，并 warn 点名两者", () => {
      const parsed = ok(
        parseCollabText(
          block(
            "skills/S36-agent-workspace-boundaries.md",
            entry("S36", "skill"),
          ),
        ),
      );

      expect(parsed.files.map((f) => f.path)).toEqual(["skills/S36.md"]);
      expect(codes(parsed.warnings)).toEqual([
        IssueCodeValues.ParsePathMismatch,
      ]);
      expect(parsed.warnings[0]?.message).toContain("skills/S36-agent-workspace-boundaries.md");
      expect(parsed.warnings[0]?.message).toContain("skills/S36.md");
    });
  });

  describe("硬失败（唯一还阻断的形态）", () => {
    it("一个合法块都没有 → Err，且判据是 isBlocking", () => {
      const found = err(parseCollabText("就是一段普通文字"));
      expect(codes(found)).toEqual([IssueCodeValues.ParseInvalid]);
      expect(found.some((i) => i.isBlocking())).toBe(true);
    });

    it("纯空白输入 → Err", () => {
      const found = err(parseCollabText("   \n\n "));
      expect(found.some((i) => i.isBlocking())).toBe(true);
    });

    it("warning 不是 Error —— 有一个合法块就 Ok（判据 issues.some(isBlocking)）", () => {
      const text = [
        entry("S1", "skill"),
        entry("x", "not-a-kind"),
      ].join("\n");
      const result = parseCollabText(text);
      expect(result.ok).toBe(true);
    });
  });
});
