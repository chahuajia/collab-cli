import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { buildBundle } from "@/application/buildBundle";
import { findCollabRoot } from "@/cli/lib/findCollabRoot";
import { parseCollabText } from "@/domain/parse/parseCollabText";
import { sha256Hex } from "@/infrastructure/crypto/sha256";
import { FileApplyWorkspace } from "@/infrastructure/fs/FileApplyWorkspace";
import type { Issue } from "@/domain/validation/Issue";

const DEFAULT_OUT = "bundle.json";
const JSON_INDENT = 2;
const STDIN = "-";

/**
 * `collab parse <source.txt|-> [--out <path>] [--stdout]`
 *
 * **A17 文本协议 → `bundle.json`** —— `apply` 的进料口。
 *
 * @remarks
 * 决策落地（2026-09-16 用户拍板）：
 * - **D1** `action` 按工作区现状推断：不存在 → `create`；已存在 → `replace` + `base_sha256`。
 *   AI 产出的批次里新建与修订本来就混在一起 —— **让工具读现状比让 AI 猜更准**。
 * - **D2** 支持 stdin（`-`）。
 * - **D3** 默认写 `bundle.json`（当前目录），`--out` 可覆盖。
 * - **D4** 只有 `--stdout`（输出就是 JSON），不另设 `--json`。
 * - **D5** 标记宽容解析（`=` 数量不固定）。
 *
 * **不做路径白名单** —— 那是 `apply` 的预检；重复就会漂移。
 */
export async function cmdParse(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      out: { type: "string" },
      stdout: { type: "boolean", default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  const source = positionals[0];
  if (source === undefined || source.length === 0) {
    throw new Error(
      "missing <source.txt|-> argument. Usage: collab parse <source.txt|-> [--out <path>] [--stdout]",
    );
  }

  const text = readSource(source);
  const parsed = parseCollabText(text);
  if (!parsed.ok) reject(parsed.error);

  // ── 推断 action：读工作区现状（D1） ──
  const { collabDir } = findCollabRoot(process.cwd());
  const workspace = new FileApplyWorkspace(collabDir);

  // 组装规则只有一份（`buildBundle`）—— MCP 的 `collab_parse` 走同一条路径。
  const bundle = buildBundle({
    blocks: parsed.value,
    workspace,
    hasher: sha256Hex,
    generatedAt: new Date().toISOString(),
    generatedBy: "collab parse",
  });
  const files = bundle.files;
  const json = JSON.stringify(bundle, null, JSON_INDENT) + "\n";

  if (values.stdout === true) {
    process.stdout.write(json);
    return;
  }

  const outArg = values.out;
  const outPath = path.resolve(
    process.cwd(),
    typeof outArg === "string" && outArg.length > 0 ? outArg : DEFAULT_OUT,
  );
  fs.writeFileSync(outPath, json, "utf8");

  const creates = files.filter((f) => f.action === "create").length;
  const replaces = files.filter((f) => f.action === "replace").length;
  console.log(
    `✔ parsed ${files.length} block(s) — ${creates} create, ${replaces} replace → ${path.relative(process.cwd(), outPath)}`,
  );
  console.log("");
  console.log(
    `Next: run \`collab apply ${path.relative(process.cwd(), outPath)}\` (use --dry-run first).`,
  );
}

/** 读输入：`-` 表示 stdin。 */
function readSource(source: string): string {
  if (source === STDIN) return fs.readFileSync(0, "utf8");
  const abs = path.resolve(process.cwd(), source);
  if (!fs.existsSync(abs)) {
    throw new Error(`source file not found: ${source}`);
  }
  return fs.readFileSync(abs, "utf8");
}

/** 切分失败：报出全部 Issue，退出码 1，不产出任何文件。 */
function reject(issues: readonly Issue[]): never {
  console.error(`✖ parse rejected: ${issues.length} issue(s) — no bundle was written.`);
  for (const issue of issues) {
    console.error(`  ${issue.format().split("\n").join("\n  ")}`);
  }
  process.exit(1);
}
