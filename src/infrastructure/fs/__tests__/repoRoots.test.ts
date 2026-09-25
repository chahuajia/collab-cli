import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  PROJECTS_DIR_ENV,
  REPO_ENV_VARS,
  REPO_NAMES,
  isRepoName,
  projectsRoot,
  repoRoot,
} from "@/infrastructure/fs/repoRoots";

/**
 * 「仓名 → 路径」的解析链。
 *
 * @remarks
 * 这条链原先在每个消费方各写一份**绝对路径**（实测：同一份 `D:\actto\...`
 * 既在 `working-memory/check-freshness.mjs` 里，又逐字复制进 `enforcedTargets.ts`，
 * 而且**随 0.5.1 发布到了 npm**）。这里钉住三件事：
 * 环境变量优先、默认值可推导、不认识的仓名要被认出来。
 *
 * **它不查什么**：不查那些路径**存在**（那要本机真有那三个仓），
 * 也不查布局是否合理 —— 布局的声明处是 `REPO_SUBPATH`，改了它这里会红，是故意的。
 */
const TOUCHED_VARS = [...Object.values(REPO_ENV_VARS), PROJECTS_DIR_ENV];
const ORIGINAL: { readonly name: string; readonly value: string | undefined }[] = TOUCHED_VARS.map(
  (name) => ({ name, value: process.env[name] }),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

afterEach(() => {
  for (const { name, value } of ORIGINAL) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("仓名解析链", () => {
  it("认得出三个已知仓名，认不出别的", () => {
    for (const name of REPO_NAMES) expect(isRepoName(name)).toBe(true);
    expect(isRepoName("evolution")).toBe(false);
    expect(isRepoName("")).toBe(false);
  });

  it("每个已知仓名都有自己的环境变量（防漏登记）", () => {
    expect(REPO_NAMES).toHaveLength(3);
    for (const name of REPO_NAMES) {
      expect(REPO_ENV_VARS[name].length).toBeGreaterThan(0);
      expect(REPO_ENV_VARS[name].endsWith("_DIR")).toBe(true);
    }
  });

  it("环境变量优先", () => {
    process.env[REPO_ENV_VARS.collaboration] = "X:/kb";
    process.env[REPO_ENV_VARS.evolutionary] = "X:/evo";
    expect(repoRoot("collaboration")).toBe("X:/kb");
    expect(repoRoot("evolutionary")).toBe("X:/evo");
  });

  it("自己这个仓按模块位置推导 —— 推到的是**含 package.json 的仓根**", () => {
    delete process.env[REPO_ENV_VARS["collab-cli"]];
    const self = repoRoot("collab-cli");
    const pkgPath = path.join(self, "package.json");
    expect(fs.existsSync(pkgPath)).toBe(true);
    // 认名字而不是认文件：改名/搬脚本不该让这条测试红（那是别的检查的事）
    const pkg: unknown = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    expect(isRecord(pkg) ? pkg["name"] : null).toBe("@chahuajia/collab-cli");
  });

  it("没有 env 时按声明的相对布局推导（本机三仓同父目录）", () => {
    delete process.env[PROJECTS_DIR_ENV];
    delete process.env[REPO_ENV_VARS.collaboration];
    expect(repoRoot("collaboration")).toBe(
      path.join(projectsRoot(), "collaboration_aggregate", "collaboration"),
    );
  });

  it("`COLLAB_PROJECTS_DIR` 能整体换根（搬目录不必改代码）", () => {
    process.env[PROJECTS_DIR_ENV] = "X:/projects";
    delete process.env[REPO_ENV_VARS.evolutionary];
    expect(repoRoot("evolutionary")).toBe(
      path.join("X:/projects", "evolutionary_start", "evolutionary"),
    );
  });
});
