// src/cli/index.ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cmdIndex } from "@/cli/commands";
import { cmdApply } from "@/cli/commands/apply";
import { cmdCatalog } from "@/cli/commands/catalog";
import { cmdCommit } from "@/cli/commands/commit";
import { cmdFix } from "@/cli/commands/fix";
import { cmdMcp } from "@/cli/commands/mcp";
import { cmdMemory } from "@/cli/commands/memory";
import { cmdNew } from "@/cli/commands/new";
import { cmdParse } from "@/cli/commands/parse";
import { cmdPush } from "@/cli/commands/push";
import { cmdRetire } from "@/cli/commands/retire";
import { cmdValidate } from "@/cli/commands/validate";
import { COLLAB_VERSION } from "@/cli/lib/version";

/**
 * 命令表 —— CLI 的**唯一**命令清单。
 *
 * @remarks
 * 导出是为了让测试能对照 `--help`：**两处不一致 = 文档承诺了不存在的行为**
 * （今天已经出现过两次：`bom` 那类误报，以及 README 里"退出码 2"从未出现）。
 */
export const COMMANDS: Record<string, (args: string[]) => Promise<void>> = {
  new: cmdNew,
  apply: cmdApply,
  catalog: cmdCatalog,
  parse: cmdParse,
  memory: cmdMemory,
  mcp: cmdMcp,
  index: cmdIndex,
  validate: cmdValidate,
  commit: cmdCommit,
  fix: cmdFix,
  retire: cmdRetire,
  push: cmdPush,
};

function printHelp(): void {
  console.log(`
collab — CLI for the COLLABORATION protocol

Usage:
  collab [--dir <path>] <command> [options]

Commands:
  new <type> [id]              Create a new entry from template
  apply <bundle.json>          Apply a bundle: all files or none
  parse <source.txt|->         Parse A17 text into bundle.json
  mcp                          Run as an MCP server on stdio (for AI clients)
  memory [--max-age <days>]    Check working-memory freshness
  catalog                      Generate catalog.json (the routing table)
  index [dir]                  Update _index.md for a directory (or all)
  validate                     Validate the entire workspace
  fix                          Fill in mechanical frontmatter fields (add-only)
  retire <id>                  Retire an entry from the routing index (not deleted).
                               --candidates lists islands (report only, never writes)
  commit -m "<message>"        Validate + git add + git commit
  push                         Validate + git push

Global options:
  --dir <path>                 COLLABORATION workspace (also: COLLAB_DIR env)

Command options (only where listed):
  --dry-run                    new / apply / fix / index / retire / push — plan only, write nothing
  --dormant                    retire — 退役路径：被冷落（过时/重复/表达差/未成熟）
  --enforced <path>            retire — 退役路径：已毕业（内容已被测试/工具固化）
  --reason "<分类>: <证据>"     retire — 必填；判据见 meta/pruning-policy
  --confirm                    retire — --enforced 的确认门
  --candidates                 retire — 列出孤岛条目（只报告）
  --grace-days <n>             retire — 孤岛宽限期，默认 30（新条目还没轮到被引用）
  --json                       validate / apply — machine-readable (shapes differ)
  --index                      apply — refresh affected _index.md files
  --commit                     apply — commit after validate passes
  -m, --message <message>      commit — commit message
  --no-validate                commit — skip validation
  --author <email>             new — override git user.email
  --remote <name>              push — remote, default "origin"
  --branch <name>              push — branch, default current

Other:
  --help, -h                   Show this help
  --version, -v                Show version

Exit codes:
  0                            ok
  1                            blocking issue or bad args (there is no exit code 2)

Examples:
  collab validate
  collab apply bundle.json --dry-run
  collab apply bundle.json --index --commit
  collab --dir /path/to/collaboration validate
  collab --dir /path/to/collaboration commit -m "feat: add S30"
  COLLAB_DIR=/path/to/collaboration collab push
`);
}
/**
 * 从 argv 中提取 `--dir <path>` 和 `--dir=<path>` —— 写入 `COLLAB_DIR`。
 *
 * @returns 移除 `--dir` 及其值后的 argv
 */
function consumeDirOption(argv: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;

    if (arg === "--dir") {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        throw new Error("--dir requires a path argument");
      }
      process.env.COLLAB_DIR = path.resolve(next);
      i++; // skip next
    } else if (arg.startsWith("--dir=")) {
      const value = arg.slice("--dir=".length);
      if (value.length === 0) {
        throw new Error("--dir requires a path argument");
      }
      process.env.COLLAB_DIR = path.resolve(value);
    } else {
      result.push(arg);
    }
  }
  return result;
}

/**
 * CLI 主入口。
 *
 * @remarks
 * **导出**：供 `bin/collab.js` import。
 * **自执行**：当"被直接执行"时（如 `node dist/cli/index.js validate`）。
 *
 * 判断方式：`process.argv[1]` 是否等于当前文件路径。
 * - 是 → 直接执行 → 自执行
 * - 否 → 被 import → 不执行
 */
export async function main(rawArgv: string[]): Promise<void> {
  const argv = consumeDirOption(rawArgv);
  const [cmd, ...rest] = argv;

  if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') {
    printHelp();
    return;
  }
  if (cmd === '--version' || cmd === '-v') {
  console.log(`collab-cli ${COLLAB_VERSION}`);
    return;
  }

  const handler = COMMANDS[cmd];
  if (!handler) {
    throw new Error(`Unknown command: ${cmd}. Run \`collab --help\` for usage.`);
  }
  await handler(rest);
}

const ARGV_OFFSET = 2;
// ─────────────────────────────────────────────
// 自执行：仅当"被直接执行"时
// ─────────────────────────────────────────────
const thisFile = fileURLToPath(import.meta.url);
const invokedAsScript =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === thisFile;

if (invokedAsScript) {
  main(process.argv.slice(ARGV_OFFSET)).catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`✖ ${msg}`);
    process.exit(1);
  });
}
