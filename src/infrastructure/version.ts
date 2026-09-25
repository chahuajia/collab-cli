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

/**
 * 生成物里该装哪条线 —— `@chahuajia/collab-cli` 的 npm 范围，如 `^0.6`。
 *
 * @remarks
 * `init` 会把安装命令写进三个生成物（kb 骨架 README、consumer wrapper、下一步提示），
 * 加命令行上的跳过说明一共**四处**。它们曾经各自手写 `@^0.5` —— 于是升到 `0.6.0` 时，
 * 四处会同时把用户钉回旧线，而且**不报错**：npx 老老实实装 0.5.x，
 * 用户拿到的是换 `parse` 契约之前的版本。
 *
 * 这是"同一事实写两处必然漂移"的又一例，所以改成从 `package.json` **派生**
 * （见 patterns/derivation-over-copy）。取 `major.minor` 而不是整串：
 * 同一 minor 线内的补丁版应当自动跟上，不必重跑 `init`。
 *
 * 读不到版本号（`0.0.0` 兜底）时退回 `latest` —— 编一个陌生的 pin 会静默装错版本。
 */
export const COLLAB_NPM_RANGE: string = npmRangeFrom(COLLAB_VERSION);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function npmRangeFrom(version: string): string {
  if (version === "0.0.0") return "latest";
  const match = /^(\d+)\.(\d+)\./.exec(version);
  return match ? `^${match[1]}.${match[2]}` : "latest";
}

function readPackageVersion(): string {
  try {
    const pkgPath = fileURLToPath(
      new URL("../../package.json", import.meta.url),
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
