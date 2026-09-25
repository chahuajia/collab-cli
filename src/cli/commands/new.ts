// src/cli/commands/new.ts
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { planCreateEntry } from "@/application/CreateEntryUseCase";
import { EntryKindValues } from "@/domain/entry/types";
import { FileWorkspaceLoader } from "@/infrastructure/fs/FileWorkspaceLoader";
import { findCollabRoot } from "@/infrastructure/fs/findCollabRoot";
import { readGitAuthor } from "@/infrastructure/git/gitIdentity";
import type { EntryKind } from "@/domain/entry/types";

/**
 * CLI 接受的 `<type>` 字符串 → 领域 `EntryKind`。
 *
 * @remarks
 * **派生，不手写**：每个 kind 的值（`skill` / `adr` / …）本来就是给命令行用的词。
 * 手抄一份清单就会漂移 —— help 里的 `--profile starter` 就是同类事故
 * （2026-09-26 最小可用性排查）。
 */
const VALID_TYPES: Record<string, EntryKind> = Object.fromEntries(
  Object.values(EntryKindValues).map((kind) => [kind, kind]),
);

/**
 * `collab new <type> [id] [--author <email>] [--dry-run]`
 *
 * 从模板生成新条目文件。**不更新 `_index.md`** —— 那是 `collab index` 的事。
 *
 * @remarks
 * 本命令只做三件事：解析参数 → 调用例拿计划 → 落盘并打印。
 * 配额判据、id 校验与生成、作者来源、模板内容都在各自该在的层里
 * （`domain/entry/agreementQuota` · `application/CreateEntryUseCase` ·
 * `infrastructure/formatting` · `infrastructure/git`）。
 */
export async function cmdNew(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      author: { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  const typeArg = positionals[0];
  if (!typeArg) {
    throw new Error("missing <type> argument. Usage: collab new <type> [id]");
  }
  const type = VALID_TYPES[typeArg];
  if (!type) {
    throw new Error(
      `unknown type "${typeArg}". Valid types: ${Object.keys(VALID_TYPES).join(", ")}`,
    );
  }

  const { collabDir, gitRoot } = findCollabRoot(process.cwd());
  const authorOpt = values.author;

  const plan = planCreateEntry(
    {
      type,
      id: positionals[1] ?? null,
      // 原样传：`--author ""` 是"显式给了空值"，由用例报错，**不在这里悄悄转成 null**
      author: typeof authorOpt === "string" ? authorOpt : null,
    },
    {
      workspace: new FileWorkspaceLoader(collabDir),
      readAuthor: () => readGitAuthor(gitRoot),
    },
  );

  const filePath = path.join(collabDir, plan.relPath);
  const display = path.relative(process.cwd(), filePath);

  if (fs.existsSync(filePath)) {
    throw new Error(`file already exists: ${display}`);
  }

  if (values["dry-run"] === true) {
    console.log(`(dry-run) would create ${display}`);
    console.log("");
    console.log("(dry-run) nothing was written.");
    return;
  }

  // 'wx' 兜住"检查之后、写之前"被并发创建的情况 —— 绝不覆盖
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, plan.content, { encoding: "utf8", flag: "wx" });

  console.log(`✔ created ${display}`);
  console.log("");
  // 「谁让派生物过期，谁负责刷新它」：新条目同时让 **_index.md** 与 **catalog.json** 过期。
  // 只说一半会让人跑完 `index` 仍然看到 validate 红（CATALOG_STALE）。
  console.log("Next: run `collab index && collab catalog` —— 两份生成物都刷新后 `validate` 才会绿。");
}
