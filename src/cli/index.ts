// src/cli/index.ts
import path from "node:path";
import { cmdIndex } from "@/cli/commands";
import { cmdCommit } from "@/cli/commands/commit";
import { cmdNew } from "@/cli/commands/new";
import { cmdPush } from "@/cli/commands/push";
import { cmdValidate } from "@/cli/commands/validate";

const COMMANDS: Record<string, (args: string[]) => Promise<void>> = {
  new: cmdNew,
  index: cmdIndex,
  validate: cmdValidate,
  commit: cmdCommit,
  push: cmdPush,
};

function printHelp(): void {
  console.log(`
collab — CLI for the COLLABORATION protocol

Usage:
  collab [--dir <path>] <command> [options]

Commands:
  new <type> [id]              Create a new entry from template
  index [dir]                  Update _index.md for a directory (or all)
  validate                     Validate the entire workspace
  commit -m "<message>"        Validate + git add + git commit
  push                         Validate + git push

Global options:
  --dir <path>                 Specify the COLLABORATION workspace directory
                               (also: COLLAB_DIR=<path> env variable)

Command options:
  -m, --message <message>      Commit message (for commit)
  --no-validate                Skip validation (for commit)
  --json                       Machine-readable output (for validate)
  --author <email>             Override git user.email (for new)
  --dry-run                    Show what would be pushed (for push)
  --remote <name>              Remote name, default "origin" (for push)
  --branch <name>              Branch name, default current (for push)

Other:
  --help, -h                   Show this help
  --version, -v                Show version

Examples:
  collab validate
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

async function main(rawArgv: string[]): Promise<void> {
  const argv = consumeDirOption(rawArgv);
  const [cmd, ...rest] = argv;

  if (!cmd || cmd === "--help" || cmd === "-h" || cmd === "help") {
    printHelp();
    return;
  }
  if (cmd === "--version" || cmd === "-v") {
    console.log("collab-cli 0.3.0");
    return;
  }

  const handler = COMMANDS[cmd];
  if (!handler) {
    throw new Error(
      `Unknown command: ${cmd}. Run \`collab --help\` for usage.`,
    );
  }
  await handler(rest);
}

const ARGV_OFFSET = 2;
main(process.argv.slice(ARGV_OFFSET)).catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`✖ ${msg}`);
  process.exit(1);
});
