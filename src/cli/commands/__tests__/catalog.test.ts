import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";
import { describe, expect, it } from "vitest";
import {
  toFail,
  toSucceed,
  useTestWorkspace,
  writeIndex,
} from "@/cli/commands/__tests__/testHelpers";

const ctx = useTestWorkspace();

function abs(rel: string): string {
  return path.join(ctx().collabDir, rel);
}

async function createBaselineCommit(): Promise<void> {
  await writeFile(path.join(ctx().root, "README.md"), "baseline\n", "utf8");
  await execa("git", ["add", "."], {
    cwd: ctx().root,
    env: { ...process.env, ...ctx().envOverrides },
  });
  await execa("git", ["commit", "-q", "-m", "baseline"], {
    cwd: ctx().root,
    env: { ...process.env, ...ctx().envOverrides },
  });
}

async function seedStaleCatalog(): Promise<string> {
  await toSucceed(["catalog"], ctx().root, ctx().envOverrides);
  const catalogPath = abs("catalog.json");
  const before = await readFile(catalogPath, "utf8");
  await writeIndex(ctx().collabDir, "skills", []);
  await toSucceed(["new", "skill", "S30"], ctx().root, ctx().envOverrides);
  await toSucceed(["index", "skills"], ctx().root, ctx().envOverrides);
  return before;
}

describe("collab catalog", () => {
  it("writes catalog.json for an empty workspace", async () => {
    await toSucceed(["catalog"], ctx().root, ctx().envOverrides);

    expect(existsSync(abs("catalog.json"))).toBe(true);
    const catalog = JSON.parse(await readFile(abs("catalog.json"), "utf8"));
    expect(catalog.summary.total).toBe(0);
  });

  describe("catalog freshness chain (round-9)", () => {
    it("C1: new + index after baseline catalog → CATALOG_STALE", async () => {
      await seedStaleCatalog();

      const result = await toFail(["validate"], ctx().root, ctx().envOverrides);
      expect(result.stdout).toContain("CATALOG_STALE");
    });

    it("C2: collab catalog clears CATALOG_STALE", async () => {
      await seedStaleCatalog();
      await toFail(["validate"], ctx().root, ctx().envOverrides);

      await toSucceed(["catalog"], ctx().root, ctx().envOverrides);

      const after = await toSucceed(
        ["validate"],
        ctx().root,
        ctx().envOverrides,
      );
      expect(after.stdout).toContain("1 entries");
      expect(after.stdout).toContain("0 issues");
    });

    it("C3: --stdout previews without fixing validate", async () => {
      const before = await seedStaleCatalog();
      await toFail(["validate"], ctx().root, ctx().envOverrides);

      const preview = await toSucceed(
        ["catalog", "--stdout"],
        ctx().root,
        ctx().envOverrides,
      );
      expect(JSON.parse(preview.stdout).summary.total).toBe(1);
      expect(await readFile(abs("catalog.json"), "utf8")).toBe(before);

      await toFail(["validate"], ctx().root, ctx().envOverrides);
    });

    it("C4: commit blocked while catalog is stale", async () => {
      await createBaselineCommit();
      await seedStaleCatalog();

      const result = await toFail(
        ["commit", "-m", "should not land"],
        ctx().root,
        ctx().envOverrides,
      );
      expect(result.stdout).toContain("validate failed");
      expect(result.stdout).toContain("Aborting commit");
    });
  });
});
