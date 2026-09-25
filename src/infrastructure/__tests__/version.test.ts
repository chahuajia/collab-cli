import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COLLAB_NPM_RANGE, COLLAB_VERSION } from "@/infrastructure/version";

/**
 * 版本与安装范围的**派生**关系。
 *
 * @remarks
 * 它不查什么：不查 npm 上是否真有这个版本，也不查 tag 指到哪 ——
 * 那是发布时人的动作（见 `RELEASE.md`）。这里只锁一件事：
 * **生成物里的安装范围不许和 `package.json` 分叉。**
 */
const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

function packageVersion(): string {
  const raw = readFileSync(path.join(ROOT, "package.json"), "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (isRecord(parsed) && typeof parsed.version === "string") {
    return parsed.version;
  }
  throw new Error("package.json 里没有 version");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

describe("版本号派生", () => {
  it("COLLAB_VERSION 就是 package.json 的 version", () => {
    expect(COLLAB_VERSION).toBe(packageVersion());
  });

  it("COLLAB_NPM_RANGE 取 major.minor 线", () => {
    const [major, minor] = packageVersion().split(".");
    expect(COLLAB_NPM_RANGE).toBe(`^${major}.${minor}`);
  });

  it("升 minor 时范围必须跟着走（回归：0.5 线曾把 0.6 的用户钉回去）", () => {
    // 例子写在这里而不是断言常量：这条测试要能在 0.7 / 1.0 时代照样读出意图
    expect(COLLAB_NPM_RANGE).not.toBe("latest");
    expect(COLLAB_NPM_RANGE).toMatch(/^\^\d+\.\d+$/);
  });
});
