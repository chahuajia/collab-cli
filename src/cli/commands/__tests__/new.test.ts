// src/cli/__tests__/new.test.ts
import { existsSync } from "node:fs";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execa } from "execa";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ValidateUseCase } from "@/application/ValidateUseCase";
import {
  toFail,
  toSucceed,
  writeAdr,
  writeEntry,
  writeIndex,
  writeSkill,
} from "@/cli/commands/__tests__/testHelpers";
import { linksResolve } from "@/domain/validation/rules/linksResolve";
import { sectionsPresent } from "@/domain/validation/rules/sectionsPresent";
import { typeMatchesDir } from "@/domain/validation/rules/typeMatchesDir";
import { FileWorkspaceLoader } from "@/infrastructure/fs/FileWorkspaceLoader";

let testRoot: string;
let collabDir: string;
let envOverrides: Record<string, string>;

/** 创建临时目录 + git 仓库 + COLLABORATION 骨架。 */
async function setupWorkspace(
  opts: {
    gitEmail?: string;
    skipGit?: boolean;
    skipEmail?: boolean;
    skipCollab?: boolean;
  } = {},
): Promise<void> {
  testRoot = await mkdtemp(path.join(tmpdir(), "collab-new-"));
  collabDir = path.join(testRoot, "COLLABORATION");

  // 空全局 git config：让测试不受开发机全局配置影响
  const emptyGitConfig = path.join(testRoot, ".empty-gitconfig");
  await writeFile(emptyGitConfig, "");
  envOverrides = {
    GIT_CONFIG_GLOBAL: emptyGitConfig,
    GIT_CONFIG_SYSTEM: emptyGitConfig,
  };

  if (!opts.skipGit) {
    await execa("git", ["init", "-q"], {
      cwd: testRoot,
      env: { ...process.env, ...envOverrides },
    });
    if (!opts.skipEmail) {
      await execa(
        "git",
        [
          "config",
          "--local",
          "user.email",
          opts.gitEmail ?? "test@example.com",
        ],
        {
          cwd: testRoot,
          env: { ...process.env, ...envOverrides },
        },
      );
      await execa("git", ["config", "--local", "user.name", "Test"], {
        cwd: testRoot,
        env: { ...process.env, ...envOverrides },
      });
    }
  }

  if (!opts.skipCollab) {
    for (const sub of [
      "skills",
      "workflows",
      "agreements",
      "patterns",
      "meta/decision-records",
    ]) {
      await mkdir(path.join(collabDir, sub), { recursive: true });
    }
  }
}

afterEach(async () => {
  if (testRoot) {
    await rm(testRoot, { recursive: true, force: true });
  }
});

describe("collab new", () => {
  // ─────────────────────────────────────────────
  // 基础场景
  // ─────────────────────────────────────────────
  describe("基础场景", () => {
    beforeEach(() => setupWorkspace());

    it("creates skill file with explicit id (E1)", async () => {
      await toSucceed(["new", "skill", "S30"], testRoot, envOverrides);

      expect(existsSync(path.join(collabDir, "skills/S30.md"))).toBe(true);
    });

    it("created file has valid frontmatter", async () => {
      await toSucceed(["new", "skill", "S30"], testRoot, envOverrides);
      const content = await readFile(
        path.join(collabDir, "skills/S30.md"),
        "utf8",
      );
      expect(content).toMatch(/^---\n/);
      expect(content).toContain("id: S30");
      expect(content).toContain("type: skill");
      expect(content).toContain("status: draft");
      expect(content).toContain("author: Test");
      // id 必须自动登记为 alias（渲染层靠它解析 id 形式的链接）
      expect(content).toContain("aliases:");
      expect(content).toContain("- S30");
    });

    it("created file contains all five sections", async () => {
      await toSucceed(["new", "skill", "S30"], testRoot, envOverrides);
      const content = await readFile(
        path.join(collabDir, "skills/S30.md"),
        "utf8",
      );
      for (const section of ["上下文", "问题", "方案", "反面", "关联"]) {
        expect(content).toContain(`## ${section}`);
      }
    });

    it("created date is today in YYYY-MM-DD", async () => {
      await toSucceed(["new", "skill", "S30"], testRoot, envOverrides);
      const content = await readFile(
        path.join(collabDir, "skills/S30.md"),
        "utf8",
      );
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      expect(content).toContain(`created: ${yyyy}-${mm}-${dd}`);
    });

    it("stdout reminds user to run collab index", async () => {
      const result = await toSucceed(
        ["new", "skill", "S30"],
        testRoot,
        envOverrides,
      );
      expect(result.stdout).toContain("collab index");
    });
  });

  // ─────────────────────────────────────────────
  // ID 自动生成
  // ─────────────────────────────────────────────
  describe("ID 自动生成", () => {
    beforeEach(() => setupWorkspace());

    it("generates S1 when no skill exists (E2)", async () => {
      await toSucceed(["new", "skill"], testRoot, envOverrides);
      expect(existsSync(path.join(collabDir, "skills/S1.md"))).toBe(true);
    });

    it("generates S6 when S1-S5 exist (E12)", async () => {
      for (let i = 1; i <= 5; i++) {
        await writeSkill(`skills/S${i}.md`, `S${i}`, collabDir);
      }
      await toSucceed(["new", "skill"], testRoot, envOverrides);
      expect(existsSync(path.join(collabDir, "skills/S6.md")));
    });

    it("generates ADR-0001 for first ADR (E4)", async () => {
      await toSucceed(["new", "adr"], testRoot, envOverrides);
      expect(
        existsSync(path.join(collabDir, "meta/decision-records/ADR-0001.md")),
      ).toBe(true);
    });

    it("generates ADR-0002 with zero-padding (E13)", async () => {
      await writeAdr(
        "meta/decision-records/ADR-0001.md",
        "ADR-0001",
        collabDir,
      );
      await toSucceed(["new", "adr"], testRoot, envOverrides);
      expect(
        existsSync(path.join(collabDir, "meta/decision-records/ADR-0002.md")),
      ).toBe(true);
    });

    it("ADR gets status: proposed, not draft (D-P0-3)", async () => {
      // ADR 的合法 status 集合里没有 draft（见 allowedStatusesFor）——
      // 曾经写死 'draft' 会让 `collab new adr` 生成一个立刻非法的条目。
      await toSucceed(["new", "adr"], testRoot, envOverrides);
      const content = await readFile(
        path.join(collabDir, "meta/decision-records/ADR-0001.md"),
        "utf8",
      );
      expect(content).toContain("status: proposed");
    });

    it("skips nested files when generating next id", async () => {
      await mkdir(path.join(collabDir, "skills/advanced"), { recursive: true });
      await writeSkill("skills/advanced/S12.md", "S12", collabDir);
      await toSucceed(["new", "skill"], testRoot, envOverrides);
      expect(existsSync(path.join(collabDir, "skills/S13.md"))).toBe(true);
    });

    it("rejects empty id (E6)", async () => {
      const result = await toFail(["new", "skill", ""], testRoot, envOverrides);
      // 空串被 EntryId.create 的 emptyId 校验拦下
      expect(result.stderr.toLowerCase()).toMatch(/empty|must not be empty/);
    });

    it("shows suggestion on prefix mismatch (E2-detail)", async () => {
      const result = await toFail(
        ["new", "skill", "X30"],
        testRoot,
        envOverrides,
      );
      // 前缀错误时，suggestion 应显示
      expect(result.stderr).toContain("→");
      expect(result.stderr).toContain("rename");
    });
  });

  // ─────────────────────────────────────────────
  // Pattern 类型
  // ─────────────────────────────────────────────
  describe("Pattern 类型", () => {
    beforeEach(() => setupWorkspace());

    it("errors when pattern id omitted (E3)", async () => {
      const result = await toFail(["new", "pattern"], testRoot, envOverrides);
      expect(result.stderr).toMatch(/id/i);
    });

    it("creates pattern with explicit id", async () => {
      await toSucceed(["new", "pattern", "my-pattern"], testRoot, envOverrides);
      expect(existsSync(path.join(collabDir, "patterns/my-pattern.md"))).toBe(
        true,
      );
    });
  });

  // ─────────────────────────────────────────────
  // 文件已存在
  // ─────────────────────────────────────────────
  describe("文件已存在", () => {
    beforeEach(() => setupWorkspace());

    it("errors when file already exists (E5)", async () => {
      await writeFile(path.join(collabDir, "skills/S30.md"), "existing");
      await toFail(["new", "skill", "S30"], testRoot, envOverrides);
    });

    it("does not overwrite existing file (E5)", async () => {
      const original = "ORIGINAL CONTENT";
      await writeFile(path.join(collabDir, "skills/S30.md"), original);
      await toFail(["new", "skill", "S30"], testRoot, envOverrides);
      const content = await readFile(
        path.join(collabDir, "skills/S30.md"),
        "utf8",
      );
      expect(content).toBe(original);
    });
  });

  // ─────────────────────────────────────────────
  // 环境错误
  // ─────────────────────────────────────────────
  describe("环境错误", () => {
    it("errors when not in git repo (E6)", async () => {
      await setupWorkspace({ skipGit: true });
      await toFail(["new", "skill", "S30"], testRoot, envOverrides);
    });

    it("errors when git user.email is not set (E7)", async () => {
      await setupWorkspace({ skipEmail: true });
      const result = await toFail(
        ["new", "skill", "S30"],
        testRoot,
        envOverrides,
      );
      expect(result.stderr).toMatch(/user\.name/i);
    });

    it("errors when COLLABORATION dir does not exist (E11)", async () => {
      await setupWorkspace({ skipCollab: true });
      await toFail(["new", "skill", "S30"], testRoot, envOverrides);
    });
  });

  // ─────────────────────────────────────────────
  // --author 参数
  // ─────────────────────────────────────────────
  describe("--author 参数", () => {
    beforeEach(() => setupWorkspace());

    it("overrides git email with --author (E8)", async () => {
      await toSucceed(
        ["new", "skill", "S30", "--author", "alice@x.com"],
        testRoot,
        envOverrides,
      );
      const content = await readFile(
        path.join(collabDir, "skills/S30.md"),
        "utf8",
      );
      expect(content).toContain("author: alice@x.com");
      expect(content).not.toContain("test@example.com");
    });
  });

  // ─────────────────────────────────────────────
  // 未知类型
  // ─────────────────────────────────────────────
  describe("未知类型", () => {
    beforeEach(() => setupWorkspace());

    it("errors for unknown type (E9)", async () => {
      const result = await toFail(["new", "foo", "X1"], testRoot, envOverrides);
      expect(result.stderr).toMatch(/unknown type/i);
    });
  });

  // ─────────────────────────────────────────────
  // 代谢配额（约定层上限）
  // ─────────────────────────────────────────────
  describe("代谢配额", () => {
    beforeEach(() => setupWorkspace());

    it("refuses a new agreement once the limit is reached", async () => {
      for (let i = 1; i <= 10; i++) {
        await writeEntry({
          relPath: `agreements/A${i}.md`,
          id: `A${i}`,
          kind: "agreement",
          collabDir,
        });
      }

      const result = await toFail(
        ["new", "agreement", "A11"],
        testRoot,
        envOverrides,
      );

      expect(result.stderr).toContain("约定已达上限");
      expect(result.stderr).toContain("10/10");
      // 没有生成文件
      expect(existsSync(path.join(collabDir, "agreements/A11.md"))).toBe(false);
    });

    it("still allows a skill when agreements are full", async () => {
      for (let i = 1; i <= 10; i++) {
        await writeEntry({
          relPath: `agreements/A${i}.md`,
          id: `A${i}`,
          kind: "agreement",
          collabDir,
        });
      }

      await toSucceed(["new", "skill", "S99"], testRoot, envOverrides);
      expect(existsSync(path.join(collabDir, "skills/S99.md"))).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // --dry-run（2026-09-16：AI 曾在真库上误跑写命令）
  // ─────────────────────────────────────────────
  describe("--dry-run", () => {
    beforeEach(() => setupWorkspace());

    it("prints the plan and writes nothing", async () => {
      const result = await toSucceed(
        ["new", "skill", "S30", "--dry-run"],
        testRoot,
        envOverrides,
      );

      expect(result.stdout).toContain("would create");
      expect(result.stdout).toContain("S30.md");
      expect(existsSync(path.join(collabDir, "skills/S30.md"))).toBe(false);
    });
  });

  // ─────────────────────────────────────────────
  // new → index → validate 联动（collab-pressure r6）
  // ─────────────────────────────────────────────
  describe("new → index → validate 联动（round-6）", () => {
    beforeEach(() => setupWorkspace());

    it("C1: new → validate fails → index → validate passes", async () => {
      await writeIndex(collabDir, "skills", []);
      await toSucceed(["new", "skill", "S30"], testRoot, envOverrides);

      const before = await toFail(["validate"], testRoot, envOverrides);
      expect(before.stdout).toContain("MISSING_FROM_INDEX");

      await toSucceed(["index", "skills"], testRoot, envOverrides);

      const after = await toSucceed(["validate"], testRoot, envOverrides);
      expect(after.stdout).toContain("1 entries");
      expect(after.stdout).toContain("0 issues");
    });

    it("C2: --dry-run leaves validate unchanged", async () => {
      await toSucceed(
        ["new", "skill", "S30", "--dry-run"],
        testRoot,
        envOverrides,
      );

      const result = await toSucceed(["validate"], testRoot, envOverrides);
      expect(result.stdout).toContain("0 entries");
      expect(result.stdout).toContain("0 issues");
    });

    it("C3: auto id + index → validate passes", async () => {
      await toSucceed(["new", "skill"], testRoot, envOverrides);
      await toSucceed(["index", "skills"], testRoot, envOverrides);

      const result = await toSucceed(["validate"], testRoot, envOverrides);
      expect(result.stdout).toContain("1 entries");
      expect(result.stdout).toContain("0 issues");
    });

    it("C4: two new entries synced by one index run", async () => {
      await toSucceed(["new", "skill", "S30"], testRoot, envOverrides);
      await toSucceed(["new", "skill", "S31"], testRoot, envOverrides);

      await toFail(["validate"], testRoot, envOverrides);
      await toSucceed(["index", "skills"], testRoot, envOverrides);

      const after = await toSucceed(["validate"], testRoot, envOverrides);
      expect(after.stdout).toContain("2 entries");
      expect(after.stdout).toContain("0 issues");
    });
  });

  // ─────────────────────────────────────────────
  // 产物通过 validate（排除 index 相关规则）
  // ─────────────────────────────────────────────
  describe("产物通过 validate", () => {
    beforeEach(() => setupWorkspace());

    /**
     * **六种 kind 都要覆盖**（2026-09-26 修的 bug）：`adr` 的章节体系与模式语言不同，
     * 而这条测试原先只测 `skill` —— 于是"`collab new adr` 生成的条目当场过不了
     * validate"躲过了全部测试（4 个 `MISSING_SECTION`）。**核实范围由想象决定**：
     * 测一种 kind 就宣布"产物通过 validate"，覆盖的是想象，不是种类。
     */
    const SAMPLES = [
      { kind: "skill", id: "S30" },
      { kind: "agreement", id: "A30" },
      { kind: "workflow", id: "W30" },
      { kind: "pattern", id: "generated-pattern" },
      { kind: "adr", id: "ADR-0030" },
      { kind: "integration", id: "generated-integration" },
    ] as const;

    it.each(SAMPLES)(
      "generated $kind file passes all domain rules (E10)",
      async ({ kind, id }) => {
        await toSucceed(["new", kind, id], testRoot, envOverrides);

        const loader = new FileWorkspaceLoader(collabDir);
        const useCase = new ValidateUseCase(loader, {
          perEntry: [typeMatchesDir, sectionsPresent, linksResolve],
          global: [],
        });
        const { report } = useCase.execute();

        expect(
          report.errors().map((i) => i.format()),
          `${kind} 模板生成的条目没通过自己的规则`,
        ).toEqual([]);
      },
    );
  });
});
