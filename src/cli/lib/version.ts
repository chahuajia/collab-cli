import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * CLI 版本号 —— **从 `package.json` 派生，不手写**。
 *
 * @remarks
 * 这个常量曾经是手写的，注释还写着「`package.json` 由人保持一致」。
 * 那不是单一真相源，是**两份手写的副本**（只是从三份降到了两份）——
 * 2026-09-25 它在一份**已发布**的包上漂了：包是 `0.5.0`，`--version` 打印 `0.4.0`。
 *
 * 用户第一次接触就撞见它，那一秒就把「这个包可靠吗」的答案写死了。
 *
 * 现在改成派生：**能派生就别复制**（见 patterns/derivation-over-copy）。
 * 读不到时返回 `0.0.0` 而不是抛错 —— 版本号不该让 CLI 起不来。
 */
export const COLLAB_VERSION: string = readPackageVersion();

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readPackageVersion(): string {
  try {
    const pkgPath = fileURLToPath(
      new URL("../../../package.json", import.meta.url),
    );
    const raw = readFileSync(pkgPath, "utf8");
    const parsed: unknown = JSON.parse(raw);

    if (isRecord(parsed)) {
      const version = parsed.version;
      if (typeof version === "string" && version.length > 0) return version;
    }
    return "0.0.0";
  } catch {
    return "0.0.0";
  }
}