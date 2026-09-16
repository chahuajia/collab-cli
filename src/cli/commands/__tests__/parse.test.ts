import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  minimalEntryContent,
  toFail,
  toSucceed,
  useTestWorkspace,
} from "@/cli/commands/__tests__/testHelpers";
import { EntryKindValues } from "@/domain/entry/types";

const ctx = useTestWorkspace();

function block(relPath: string, body: string): string {
  return `===== FILE: ${relPath} =====\n${body}\n===== END FILE =====`;
}

const IN = "in.txt";

async function writeInput(text: string, name = IN): Promise<string> {
  await writeFile(path.join(ctx().root, name), text, "utf8");
  return name;
}

describe("collab parse", () => {
  it("writes a bundle that apply accepts (end to end)", async () => {
    const body = minimalEntryContent({
      id: "S31",
      kind: EntryKindValues.Skill,
    });
    await writeInput(block("skills/S31-x.md", body));

    await toSucceed(["parse", IN], ctx().root, ctx().envOverrides);

    const bundle = JSON.parse(
      await readFile(path.join(ctx().root, "bundle.json"), "utf8"),
    );
    expect(bundle.files).toHaveLength(1);
    expect(bundle.files[0].action).toBe("create");
    expect(bundle.files[0].content).toBe(body);

    // 关键：parse 的产物能被 apply 直接吃下
    await toSucceed(["apply", "bundle.json"], ctx().root, ctx().envOverrides);
    expect(existsSync(path.join(ctx().collabDir, "skills/S31-x.md"))).toBe(true);
  });

  it("infers replace + base_sha256 when the file already exists (D1)", async () => {
    await writeFile(
      path.join(ctx().collabDir, "skills/S31-x.md"),
      "旧内容",
      "utf8",
    );
    await writeInput(block("skills/S31-x.md", "新内容"));

    await toSucceed(["parse", IN], ctx().root, ctx().envOverrides);

    const bundle = JSON.parse(
      await readFile(path.join(ctx().root, "bundle.json"), "utf8"),
    );
    expect(bundle.files[0].action).toBe("replace");
    expect(bundle.files[0].base_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("--stdout prints JSON and writes nothing (D4)", async () => {
    await writeInput(block("skills/S31-x.md", "body"));

    const result = await toSucceed(
      ["parse", IN, "--stdout"],
      ctx().root,
      ctx().envOverrides,
    );

    expect(JSON.parse(result.stdout).version).toBe(1);
    expect(existsSync(path.join(ctx().root, "bundle.json"))).toBe(false);
  });

  it("--out writes elsewhere (D3)", async () => {
    await writeInput(block("skills/S31-x.md", "body"));
    await toSucceed(
      ["parse", IN, "--out", "custom.json"],
      ctx().root,
      ctx().envOverrides,
    );
    expect(existsSync(path.join(ctx().root, "custom.json"))).toBe(true);
  });

  it("rejects a paste with an opening line and writes nothing", async () => {
    await writeInput(`这是开场白\n${block("skills/S31-x.md", "body")}`);

    const result = await toFail(["parse", IN], ctx().root, ctx().envOverrides);

    expect(result.stderr).toContain("content outside any block");
    expect(existsSync(path.join(ctx().root, "bundle.json"))).toBe(false);
  });

  it("errors when the source file does not exist", async () => {
    const result = await toFail(["parse", "nope.txt"], ctx().root, ctx().envOverrides);
    expect(result.stderr).toContain("not found");
  });
});
