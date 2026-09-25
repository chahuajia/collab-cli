import { existsSync, readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  minimalEntryContent,
  toFail,
  toSucceed,
  useTestWorkspace,
  writeEntry,
} from "@/cli/commands/__tests__/testHelpers";
import { EntryKindValues } from "@/domain/entry/types";

const ctx = useTestWorkspace();

/**
 * **真产物夹具**（对话式 AI 的实际输出，原样，CRLF）。
 *
 * @remarks
 * 它旁边就是验收标准：「不需要人工裁剪就能落盘」。以前这条标准只能手工跑
 * （夹具在仓外），现在它是 CI 里的一条。
 */
const REAL_OUTPUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../infrastructure/parsing/__tests__/fixtures/real-ai-output.txt",
);

/**
 * `===== FILE:` 只是**可选冗余**（ADR-0012）—— 路径由条目自己的 frontmatter 派生。
 * 这里让标记与派生路径一致，模拟"AI 老实写了标记"的形态。
 */
function block(relPath: string, body: string): string {
  return `===== FILE: ${relPath} =====\n${body}\n===== END FILE =====`;
}

const IN = "in.txt";

/** S31 是 skill → 派生到 `skills/S31.md`。 */
const S31_REL = "skills/S31.md";
const S31 = (): string =>
  minimalEntryContent({ id: "S31", kind: EntryKindValues.Skill });

async function writeInput(text: string, name = IN): Promise<string> {
  await writeFile(path.join(ctx().root, name), text, "utf8");
  return name;
}

describe("collab parse", () => {
  it("writes a bundle that apply accepts (end to end)", async () => {
    const body = S31();
    await writeInput(block(S31_REL, body));

    await toSucceed(["parse", IN], ctx().root, ctx().envOverrides);

    const bundle = JSON.parse(
      await readFile(path.join(ctx().root, "bundle.json"), "utf8"),
    );
    expect(bundle.files).toHaveLength(1);
    // 路径是**派生**的：type=skill + id=S31 → skills/S31.md（标记只是提示）
    expect(bundle.files[0].path).toBe(S31_REL);
    expect(bundle.files[0].action).toBe("create");
    expect(bundle.files[0].content).toBe(body);

    // 关键：parse 的产物能被 apply 直接吃下
    await toSucceed(["apply", "bundle.json"], ctx().root, ctx().envOverrides);
    expect(existsSync(path.join(ctx().collabDir, S31_REL))).toBe(true);
  });

  it("infers replace + base_sha256 when the file already exists (D1)", async () => {
    await writeFile(path.join(ctx().collabDir, S31_REL), S31(), "utf8");
    await writeInput(block(S31_REL, S31()));

    await toSucceed(["parse", IN], ctx().root, ctx().envOverrides);

    const bundle = JSON.parse(
      await readFile(path.join(ctx().root, "bundle.json"), "utf8"),
    );
    expect(bundle.files[0].action).toBe("replace");
    expect(bundle.files[0].base_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("--stdout prints JSON and writes nothing (D4)", async () => {
    await writeInput(block(S31_REL, S31()));

    const result = await toSucceed(
      ["parse", IN, "--stdout"],
      ctx().root,
      ctx().envOverrides,
    );

    expect(JSON.parse(result.stdout).version).toBe(1);
    expect(existsSync(path.join(ctx().root, "bundle.json"))).toBe(false);
  });

  it("--out writes elsewhere (D3)", async () => {
    await writeInput(block(S31_REL, S31()));
    await toSucceed(
      ["parse", IN, "--out", "custom.json"],
      ctx().root,
      ctx().envOverrides,
    );
    expect(existsSync(path.join(ctx().root, "custom.json"))).toBe(true);
  });

  it("开场白不再让它拒收 —— 原样粘贴即可（ADR-0012）", async () => {
    await writeInput(`好的，以下是条目：\n\n${block(S31_REL, S31())}`);

    await toSucceed(["parse", IN], ctx().root, ctx().envOverrides);

    expect(existsSync(path.join(ctx().root, "bundle.json"))).toBe(true);
  });

  it("跳过的块报到 stderr（宽容 ≠ 静默）", async () => {
    // 协议示例块：有标记、无 frontmatter → 跳过并 warn，但不废掉整批
    await writeInput(
      `${block("<相对路径>", "<完整内容>")}\n${block(S31_REL, S31())}`,
    );

    const result = await toSucceed(["parse", IN], ctx().root, ctx().envOverrides);

    expect(result.stderr).toContain("SKIPPED_BLOCK");
    const bundle = JSON.parse(
      await readFile(path.join(ctx().root, "bundle.json"), "utf8"),
    );
    expect(bundle.files).toHaveLength(1);
  });

  it("一个合法块都没有 → 拒收且不写 bundle", async () => {
    await writeInput("就是一段普通文字");

    const result = await toFail(["parse", IN], ctx().root, ctx().envOverrides);

    expect(result.stderr).toContain("no entry block found");
    expect(existsSync(path.join(ctx().root, "bundle.json"))).toBe(false);
  });

  it("真产物（仓内夹具）→ 原样落盘，不需人工裁剪", async () => {
    // 条目正文链到库里另外三条 —— 落盘后的内容校验会判死链（那是它该做的），先建出来
    const linked = [
      { relPath: "agreements/A10-review-前置原则.md", id: "A10", kind: EntryKindValues.Agreement },
      { relPath: "patterns/design-decision.md", id: "design-decision", kind: EntryKindValues.Pattern },
      { relPath: "integrations/chatgpt-output-format.md", id: "chatgpt-output-format", kind: EntryKindValues.Integration },
    ] as const;
    for (const e of linked) {
      await writeEntry({ ...e, collabDir: ctx().collabDir });
    }

    const fixture = readFileSync(REAL_OUTPUT, "utf8");
    await writeInput(fixture);

    await toSucceed(["parse", IN], ctx().root, ctx().envOverrides);
    await toSucceed(["apply", "bundle.json", "--index"], ctx().root, ctx().envOverrides);

    const landed = await readFile(
      path.join(ctx().collabDir, "patterns/lenient-parsing.md"),
      "utf8",
    );
    const expected = fixture
      .replace(/^===== FILE:[^\n]*\r?\n/, "")
      .replace(/\r?\n===== END FILE =====\r?\n?$/, "");

    expect(landed).toBe(expected);
    // 夹具里的包装/表/追问都不该落盘（落盘的是条目本身）
    expect(landed).not.toContain("===== FILE:");
    expect(landed).not.toContain("END FILE");
    expect(landed).toContain("[[chatgpt-output-format]]");
  });

  it("errors when the source file does not exist", async () => {
    const result = await toFail(["parse", "nope.txt"], ctx().root, ctx().envOverrides);
    expect(result.stderr).toContain("not found");
  });

  describe("parse → apply 联动（collab-pressure r4）", () => {
    it("parse → apply --index → validate 全绿（C1）", async () => {
      await writeInput(block(S31_REL, S31()));

      await toSucceed(["parse", IN], ctx().root, ctx().envOverrides);
      await toSucceed(
        ["apply", "bundle.json", "--index"],
        ctx().root,
        ctx().envOverrides,
      );
      await toSucceed(["validate"], ctx().root, ctx().envOverrides);
    });

    it("多 FILE 块一次 apply 刷新 catalog（C2）", async () => {
      const b1 = S31();
      const b2 = minimalEntryContent({
        id: "S32",
        kind: EntryKindValues.Skill,
      });
      await writeInput(`${block(S31_REL, b1)}\n${block("skills/S32.md", b2)}`);

      await toSucceed(["parse", IN], ctx().root, ctx().envOverrides);
      await toSucceed(["apply", "bundle.json"], ctx().root, ctx().envOverrides);

      const catalog = JSON.parse(
        await readFile(path.join(ctx().collabDir, "catalog.json"), "utf8"),
      );
      expect(catalog.summary.total).toBe(2);
    });

    it("parse 后文件被改 → apply 拒绝 stale base（C3）", async () => {
      await writeFile(path.join(ctx().collabDir, S31_REL), "旧内容", "utf8");
      await writeInput(block(S31_REL, S31()));

      await toSucceed(["parse", IN], ctx().root, ctx().envOverrides);
      await writeFile(path.join(ctx().collabDir, S31_REL), "外部篡改", "utf8");

      const result = await toFail(
        ["apply", "bundle.json"],
        ctx().root,
        ctx().envOverrides,
      );
      expect(result.stdout).toContain("modified externally");
    });
  });
});
