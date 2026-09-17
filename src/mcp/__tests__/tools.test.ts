import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execa } from "execa";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CLI_ENTRY,
  minimalEntryContent,
} from "@/cli/commands/__tests__/testHelpers";
import { EntryKindValues } from "@/domain/entry/types";
import { sha256Hex } from "@/infrastructure/crypto/sha256";
import { runTool } from "@/mcp/handlers";
import type { ToolContext, ToolOutcome } from "@/mcp/handlers";

const AGREEMENT_REL = "agreements/A10-测试条目.md";
const AGREEMENT_ID = "A10";

let root: string;
let ctx: ToolContext;

/** 调用工具并解析 JSON 结果 —— 工具的契约是"文本里是 JSON"。 */
function call(
  name: string,
  args: Readonly<Record<string, unknown>>,
): { readonly parsed: Record<string, unknown>; readonly outcome: ToolOutcome } {
  const outcome = runTool(name, args, ctx);
  return { parsed: JSON.parse(outcome.text), outcome };
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "collab-mcp-"));
  ctx = { cwd: root, dir: root };

  await mkdir(path.join(root, "agreements"), { recursive: true });
  await mkdir(path.join(root, "skills"), { recursive: true });
  await writeFile(
    path.join(root, AGREEMENT_REL),
    minimalEntryContent({
      id: AGREEMENT_ID,
      kind: EntryKindValues.Agreement,
      status: "active",
    }),
    "utf8",
  );
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("MCP 工具", () => {
  describe("collab_catalog", () => {
    it("列出条目（id / 类型 / 状态 / 路径）", () => {
      const { parsed, outcome } = call("collab_catalog", {});
      expect(outcome.isError).toBe(false);
      expect(parsed.summary).toMatchObject({ total: 1 });
      expect(parsed.entries).toContainEqual(
        expect.objectContaining({
          id: AGREEMENT_ID,
          type: "agreement",
          path: AGREEMENT_REL,
        }),
      );
    });

    it("按类型过滤后没有命中就返回空表", () => {
      const { parsed } = call("collab_catalog", { type: "skill" });
      expect(parsed.matched).toBe(0);
    });

    it("不写 catalog.json —— 只读工具不该有副作用", () => {
      call("collab_catalog", {});
      expect(existsSync(path.join(root, "catalog.json"))).toBe(false);
    });
  });

  describe("collab_read", () => {
    it("按 id 读全文", () => {
      const { parsed, outcome } = call("collab_read", { id: AGREEMENT_ID });
      expect(outcome.isError).toBe(false);
      expect(parsed.frontmatter).toMatchObject({ id: AGREEMENT_ID });
      expect(String(parsed.body)).toContain("## 上下文");
    });

    it("按路径读（容忍 .md 后缀与大小写差异）", () => {
      const { parsed, outcome } = call("collab_read", {
        path: AGREEMENT_REL.replace(/\.md$/, ""),
      });
      expect(outcome.isError).toBe(false);
      expect(parsed.frontmatter).toMatchObject({ id: AGREEMENT_ID });
    });

    it("bodyOnly 只回正文", () => {
      const { parsed } = call("collab_read", {
        id: AGREEMENT_ID,
        bodyOnly: true,
      });
      expect(parsed.frontmatter).toBeUndefined();
      expect(String(parsed.body)).toContain("## 上下文");
    });

    it("找不到 → isError（工具错，不是协议错）", () => {
      const { parsed, outcome } = call("collab_read", { id: "S999" });
      expect(outcome.isError).toBe(true);
      expect(parsed.found).toBe(false);
    });

    it("既没给 id 也没给 path → 参数错", () => {
      expect(() => call("collab_read", {})).toThrow(/`id` or `path`/);
    });
  });

  describe("collab_search", () => {
    it("命中并给出片段", () => {
      const { parsed, outcome } = call("collab_search", { query: "上下文" });
      expect(outcome.isError).toBe(false);
      expect(parsed.matched).toBe(1);
      expect(parsed.matches).toContainEqual(
        expect.objectContaining({ id: AGREEMENT_ID }),
      );
    });

    it("id 命中排在正文命中之前", () => {
      const { parsed } = call("collab_search", { query: AGREEMENT_ID });
      const first = Array.isArray(parsed.matches) ? parsed.matches[0] : null;
      expect(first).toMatchObject({ id: AGREEMENT_ID, rank: 3 });
    });

    it("没命中就是空表（不是错误）", () => {
      const { parsed, outcome } = call("collab_search", {
        query: "绝不存在的字符串xyzzy",
      });
      expect(outcome.isError).toBe(false);
      expect(parsed.matched).toBe(0);
    });

    it("缺 query → 参数错", () => {
      expect(() => call("collab_search", {})).toThrow(/`query` is required/);
    });
  });

  describe("MCP discovery chain（round-12）", () => {
    it("C1: search hit → read by id returns full entry", () => {
      const { parsed: search, outcome: searchOutcome } = call(
        "collab_search",
        { query: AGREEMENT_ID },
      );
      expect(searchOutcome.isError).toBe(false);
      expect(Array.isArray(search.matches)).toBe(true);
      const matches = search.matches;
      if (!Array.isArray(matches) || matches.length === 0) {
        throw new Error("expected search matches");
      }
      const first = matches[0];
      if (typeof first !== "object" || first === null || !("id" in first)) {
        throw new Error("expected match with id");
      }
      const hitId = first.id;
      if (typeof hitId !== "string") {
        throw new Error("expected string id");
      }

      const { parsed: read, outcome: readOutcome } = call("collab_read", {
        id: hitId,
      });
      expect(readOutcome.isError).toBe(false);
      expect(read.frontmatter).toMatchObject({ id: AGREEMENT_ID });
      expect(String(read.body)).toContain("## 方案");
    });

    it("C2: content validate green while standard fails without index", () => {
      const { parsed: content, outcome: contentOutcome } = call(
        "collab_validate",
        { scope: "content" },
      );
      expect(contentOutcome.isError).toBe(false);
      expect(content.summary).toMatchObject({ errors: 0 });

      const { parsed: standard, outcome: standardOutcome } = call(
        "collab_validate",
        {},
      );
      expect(standardOutcome.isError).toBe(true);
      expect(JSON.stringify(standard.issues)).toContain("MISSING_INDEX");
    });

    it("C3: zero search hits still allows scoped validate", () => {
      const { parsed: search, outcome: searchOutcome } = call(
        "collab_search",
        { query: "绝不存在的字符串xyzzy" },
      );
      expect(searchOutcome.isError).toBe(false);
      expect(search.matched).toBe(0);

      const { parsed: validate, outcome: validateOutcome } = call(
        "collab_validate",
        { scope: "content" },
      );
      expect(validateOutcome.isError).toBe(false);
      expect(validate.summary).toMatchObject({ errors: 0 });
    });

    it("C4: broken entry readable but content validate fails", async () => {
      const broken = [
        "---",
        "id: S99",
        "type: skill",
        "status: draft",
        "created: 2026-09-17",
        "updated: 2026-09-17",
        "author: test@example.com",
        "aliases:",
        "  - S99",
        "---",
        "",
        "# 缺章节",
        "",
      ].join("\n");
      await writeFile(path.join(root, "skills/S99-broken.md"), broken, "utf8");

      const { parsed: read, outcome: readOutcome } = call("collab_read", {
        id: "S99",
      });
      expect(readOutcome.isError).toBe(false);
      expect(String(read.body)).toContain("缺章节");

      const { parsed: validate, outcome: validateOutcome } = call(
        "collab_validate",
        { scope: "content" },
      );
      expect(validateOutcome.isError).toBe(true);
      expect(validate.summary).toMatchObject({
        errors: expect.any(Number),
      });
      expect(JSON.stringify(validate.issues)).toContain("MISSING_SECTION");
    });
  });

  describe("collab_validate", () => {
    it("content 范围：条目自身合法 → 绿", () => {
      const { parsed, outcome } = call("collab_validate", { scope: "content" });
      expect(parsed.summary).toMatchObject({ errors: 0 });
      expect(outcome.isError).toBe(false);
    });

    it("standard 范围：缺 _index.md 就是 error（并置 isError）", () => {
      const { parsed, outcome } = call("collab_validate", {});
      expect(outcome.isError).toBe(true);
      const summary = parsed.summary;
      expect(summary).toMatchObject({ errors: expect.any(Number) });
      expect(JSON.stringify(parsed.issues)).toContain("MISSING_INDEX");
    });

    it("scope 只认两个值", () => {
      expect(() => call("collab_validate", { scope: "全部" })).toThrow(
        /`scope` must be/,
      );
    });

    it("uses per-call dir when server has no default workspace", () => {
      const bareCtx: ToolContext = { cwd: root, dir: null };
      const outcome = runTool(
        "collab_validate",
        { dir: root, scope: "content" },
        bareCtx,
      );
      const parsed: unknown = JSON.parse(outcome.text);
      expect(parsed).toMatchObject({ summary: { errors: 0 } });
      expect(outcome.isError).toBe(false);
    });

    it("errors when neither default workspace nor dir is provided", () => {
      const bareCtx: ToolContext = { cwd: root, dir: null };
      expect(() => runTool("collab_validate", {}, bareCtx)).toThrow(/pass `dir`/);
    });
  });

  describe("collab_parse", () => {
    // 注意：块**外面**不允许有内容（"开场白"会被判为 PARSE_INVALID）——
    // 这是 `parseCollabText` 的既定契约，测试必须按它构造输入。
    const TEXT = [
      "===== FILE: agreements/A11-新条目.md =====",
      minimalEntryContent({
        id: "A11",
        kind: EntryKindValues.Agreement,
        status: "active",
      }),
      "===== END FILE =====",
    ].join("\n");

    it("切分文本并按工作区现状推断 action（不存在 → create）", () => {
      const { parsed, outcome } = call("collab_parse", { text: TEXT });
      expect(outcome.isError).toBe(false);
      expect(parsed.fileCount).toBe(1);
      const bundle = parsed.bundle;
      expect(bundle).toMatchObject({ version: 1, files: [{ action: "create" }] });
    });

    it("已存在的文件 → replace 且带 base_sha256", () => {
      const text = TEXT.replace("agreements/A11-新条目.md", AGREEMENT_REL);
      const { parsed } = call("collab_parse", { text });
      expect(parsed.bundle).toMatchObject({
        files: [{ action: "replace", base_sha256: expect.any(String) }],
      });
    });

    it("不落盘：解析完磁盘上什么都不多", () => {
      const before = existsSync(path.join(root, "agreements/A11-新条目.md"));
      call("collab_parse", { text: TEXT });
      const after = existsSync(path.join(root, "agreements/A11-新条目.md"));
      expect(before).toBe(false);
      expect(after).toBe(false);
    });

    it("格式不对 → isError 且列出全部 Issue", () => {
      const { parsed, outcome } = call("collab_parse", {
        text: "===== FILE: a.md =====\n没有结束标记",
      });
      expect(outcome.isError).toBe(true);
      expect(parsed.parsed).toBe(false);
    });

    it("块外有内容 → 拒绝（宽容的是标记，不是结构）", () => {
      const { parsed, outcome } = call("collab_parse", {
        text: `开场白\n${TEXT}`,
      });
      expect(outcome.isError).toBe(true);
      expect(JSON.stringify(parsed.issues)).toContain("outside any block");
    });

    it("collab_parse 产物 → collab_apply_plan 可预演（C4）", () => {
      const { parsed: parseOut, outcome: parseOutcome } = call("collab_parse", {
        text: TEXT,
      });
      expect(parseOutcome.isError).toBe(false);

      const { parsed: planOut, outcome: planOutcome } = call(
        "collab_apply_plan",
        { bundle: parseOut.bundle },
      );
      expect(planOutcome.isError).toBe(false);
      expect(planOut.status).toBe("planned");
      expect(planOut.summary).toMatchObject({ create: 1 });
    });
  });

  describe("collab_apply_plan", () => {
    it("对合法 bundle 出计划，且**一个字节都不写**", () => {
      const content = minimalEntryContent({
        id: "A12",
        kind: EntryKindValues.Agreement,
        status: "active",
      });
      const target = "agreements/A12-新条目.md";

      const { parsed, outcome } = call("collab_apply_plan", {
        bundle: {
          version: 1,
          generated_at: "2026-09-16T00:00:00.000Z",
          generated_by: "test",
          base_commit: null,
          files: [
            {
              path: target,
              action: "create",
              content,
              sha256: sha256Hex(content),
              base_sha256: null,
            },
          ],
        },
      });

      expect(outcome.isError).toBe(false);
      expect(parsed).toMatchObject({ status: "planned", wrote: 0 });
      expect(parsed.operations).toContainEqual({
        action: "create",
        path: target,
      });
      expect(existsSync(path.join(root, target))).toBe(false);
    });

    it("路径不在白名单 → 拒绝，且写出明确原因", () => {
      const content = "hello";
      const { parsed, outcome } = call("collab_apply_plan", {
        bundle: {
          version: 1,
          files: [
            {
              path: "README.md",
              action: "create",
              content,
              sha256: sha256Hex(content),
              base_sha256: null,
            },
          ],
        },
      });
      expect(outcome.isError).toBe(true);
      expect(parsed).toMatchObject({ status: "rejected", wrote: 0 });
    });

    it("base_sha256 与现状不符（乐观锁失效）→ 拒绝", () => {
      const content = minimalEntryContent({
        id: AGREEMENT_ID,
        kind: EntryKindValues.Agreement,
        status: "active",
      });
      const { parsed, outcome } = call("collab_apply_plan", {
        bundle: {
          version: 1,
          files: [
            {
              path: AGREEMENT_REL,
              action: "replace",
              content,
              sha256: sha256Hex(content),
              base_sha256: sha256Hex("这不是文件当前的内容"),
            },
          ],
        },
      });
      expect(outcome.isError).toBe(true);
      expect(parsed.status).toBe("rejected");
    });

    it("缺 bundle → 参数错", () => {
      expect(() => call("collab_apply_plan", {})).toThrow(
        /`bundle` is required/,
      );
    });
  });
});

describe("CLI catalog ↔ MCP collab_catalog（round-10）", () => {
  let gitRoot: string;
  let collabDir: string;
  let envOverrides: Record<string, string>;
  let mcpCtx: ToolContext;

  async function runCli(args: string[]) {
    return execa("node", [CLI_ENTRY, ...args], {
      cwd: gitRoot,
      reject: false,
      env: { ...process.env, ...envOverrides },
    });
  }

  function catalogCore(raw: Record<string, unknown>) {
    return {
      summary: raw.summary,
      entries: raw.entries,
    };
  }

  beforeEach(async () => {
    gitRoot = await mkdtemp(path.join(tmpdir(), "collab-mcp-r10-"));
    collabDir = path.join(gitRoot, "COLLABORATION");

    const emptyGitConfig = path.join(gitRoot, ".empty-gitconfig");
    await writeFile(emptyGitConfig, "");
    envOverrides = {
      GIT_CONFIG_GLOBAL: emptyGitConfig,
      GIT_CONFIG_SYSTEM: emptyGitConfig,
    };

    await execa("git", ["init", "-q"], {
      cwd: gitRoot,
      env: { ...process.env, ...envOverrides },
    });
    await execa(
      "git",
      ["config", "--local", "user.email", "test@example.com"],
      { cwd: gitRoot, env: { ...process.env, ...envOverrides } },
    );
    await execa("git", ["config", "--local", "user.name", "Test"], {
      cwd: gitRoot,
      env: { ...process.env, ...envOverrides },
    });

    for (const sub of ["agreements", "skills"]) {
      await mkdir(path.join(collabDir, sub), { recursive: true });
    }

    await writeFile(
      path.join(collabDir, AGREEMENT_REL),
      minimalEntryContent({
        id: AGREEMENT_ID,
        kind: EntryKindValues.Agreement,
        status: "active",
      }),
      "utf8",
    );

    mcpCtx = { cwd: gitRoot, dir: collabDir };
  });

  afterEach(async () => {
    await rm(gitRoot, { recursive: true, force: true });
  });

  it("C1: CLI catalog.json matches MCP collab_catalog entries", async () => {
    expect((await runCli(["catalog"])).exitCode).toBe(0);

    const onDisk = JSON.parse(
      await readFile(path.join(collabDir, "catalog.json"), "utf8"),
    );
    const outcome = runTool("collab_catalog", { dir: collabDir }, mcpCtx);
    const live = JSON.parse(outcome.text);

    expect(catalogCore(live)).toEqual(catalogCore(onDisk));
    expect(outcome.isError).toBe(false);
  });

  it("C2: MCP collab_catalog still writes nothing", async () => {
    await runCli(["catalog"]);
    const before = await readFile(
      path.join(collabDir, "catalog.json"),
      "utf8",
    );

    runTool("collab_catalog", { dir: collabDir }, mcpCtx);

    expect(await readFile(path.join(collabDir, "catalog.json"), "utf8")).toBe(
      before,
    );
  });

  it("C3: MCP type filter is a subset of on-disk catalog", async () => {
    await writeFile(
      path.join(collabDir, "skills/S1.md"),
      minimalEntryContent({
        id: "S1",
        kind: EntryKindValues.Skill,
      }),
      "utf8",
    );
    await runCli(["catalog"]);

    const onDisk = JSON.parse(
      await readFile(path.join(collabDir, "catalog.json"), "utf8"),
    );
    const outcome = runTool(
      "collab_catalog",
      { dir: collabDir, type: "skill" },
      mcpCtx,
    );
    const filtered = JSON.parse(outcome.text);

    expect(filtered.matched).toBe(1);
    expect(onDisk.entries.map((e: { id: string }) => e.id)).toContain("S1");
    expect(filtered.entries).toEqual(
      onDisk.entries.filter((e: { type: string }) => e.type === "skill"),
    );
  });

  it("C4: stale on-disk catalog while MCP stays live", async () => {
    await runCli(["catalog"]);
    await writeFile(
      path.join(collabDir, "skills/S2.md"),
      minimalEntryContent({
        id: "S2",
        kind: EntryKindValues.Skill,
      }),
      "utf8",
    );

    const live = JSON.parse(
      runTool("collab_catalog", { dir: collabDir }, mcpCtx).text,
    );
    expect(live.summary).toMatchObject({ total: 2 });

    const validate = await runCli(["validate"]);
    expect(validate.exitCode).not.toBe(0);
    expect(validate.stdout).toContain("CATALOG_STALE");
  });
});

const REAL_COLLAB_DIR =
  "D:\\actto\\front\\project\\collaboration_aggregate\\collaboration";

describe.skipIf(!existsSync(REAL_COLLAB_DIR))(
  "MCP collab_validate — 真库（collab-pressure）",
  () => {
    it("validates 113 entries with 0 errors via dir arg", () => {
      const outcome = runTool(
        "collab_validate",
        { dir: REAL_COLLAB_DIR },
        { cwd: process.cwd(), dir: null },
      );
      const parsed: unknown = JSON.parse(outcome.text);
      expect(parsed).toMatchObject({
        entries: 113,
        summary: { errors: 0, warnings: 0 },
      });
      expect(outcome.isError).toBe(false);
    });
  },
);
