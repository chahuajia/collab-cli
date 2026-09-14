// src/cli/index.ts
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
  collab <command> [options]

Commands:
  new <type> [id]              Create a new entry from template
  index [dir]                  Update _index.md for a directory (or all)
  validate                     Validate the entire workspace
  commit -m "<message>"        Validate + git add + git commit
  push                         Validate + git push

Types:
  skill, workflow, agreement, pattern, adr

Options:
  -m, --message <message>      Commit message (for commit)
  --no-validate                Skip validation (for commit)
  --dry-run                    Show what would be pushed (for push)
  --remote <name>              Remote name, default "origin" (for push)
  --branch <name>              Branch name, default current (for push)
  --json                       Machine-readable output (for validate)
  --author <email>             Override git user.email (for new)
  --help, -h                   Show this help
  --version, -v                Show version

Examples:
  collab new skill S30
  collab index
  collab validate
  collab commit -m "feat: add S30 skill"
  collab push
  collab push --dry-run
`);
}async function main(argv: string[]): Promise<void> {
    const [cmd, ...rest] = argv;

    if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') {
        printHelp();
        return;
    }
    if (cmd === '--version' || cmd === '-v') {
        console.log('collab-cli 0.3.0');
        return;
    }

    const handler = COMMANDS[cmd];
    if (!handler) {
        throw new Error(`Unknown command: ${cmd}. Run \`collab --help\` for usage.`);
    }
    await handler(rest);
}

const ARGV_OFFSET = 2;
main(process.argv.slice(ARGV_OFFSET)).catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`✖ ${msg}`);
  process.exit(1);
});