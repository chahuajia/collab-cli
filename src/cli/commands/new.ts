// src/cli/commands/new.ts
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from "node:util";
import { computeNextId } from "@/application/computeNextId";
import { extractIdsForKind } from "@/application/extractIdsForKind";
import { findCollabRoot } from "@/cli/lib/findCollabRoot";
import { buildTemplate } from "@/cli/lib/templates";
import { EntryId } from "@/domain/entry/EntryId";
import {
  type EntryKind,
  EntryKindDir,
  EntryKindValues,
} from "@/domain/entry/types";
import { FileWorkspaceLoader } from "@/infrastructure/fs/FileWorkspaceLoader";


/**
 * CLI 接受的 `<type>` 字符串到领域 EntryKind 的映射。
 */
const VALID_TYPES: Record<string, EntryKind> = {
    skill: EntryKindValues.Skill,
    workflow: EntryKindValues.Workflow,
    agreement: EntryKindValues.Agreement,
    pattern: EntryKindValues.Pattern,
    adr: EntryKindValues.Adr,
    integration: EntryKindValues.Integration,
};

/**
 * 约定层的**上限**。
 *
 * @remarks
 * 这是全库唯一的"环境型代谢机制"：**让"加"包含"减"的代价**。
 *
 * 为什么只限 `agreement`：协议层是**稀缺**的（每加一条，向未来每一次交互收税），
 * 而技能/模式/工作流是**手册**，本来就该增长，成本只在检索。
 *
 * 为什么没有 `--force`：绕过它的成本必须高于遵守它的成本。
 * 一个便宜的逃生口会让它退化成仪式 —— 那与"给鼓励"是同一类失效。
 */
const AGREEMENT_LIMIT = 10;

/**
 * `collab new <type> [id] [--author <email>]`
 *
 * 从模板生成新条目文件。不更新 `_index.md`——那由 `collab index` 负责。
 */
export async function cmdNew(args: string[]): Promise<void> {
    const { values, positionals } = parseArgs({
        args,
        options: {
            author: { type: 'string' },
        },
        allowPositionals: true,
        strict: false,
    });

    // 1. 解析 type
    const typeArg = positionals[0];
    if (!typeArg) {
        throw new Error('missing <type> argument. Usage: collab new <type> [id]');
    }
    const type = VALID_TYPES[typeArg];
    if (!type) {
        throw new Error(
            `unknown type "${typeArg}". Valid types: ${Object.keys(VALID_TYPES).join(', ')}`,
        );
    }

    // 2. 定位 COLLABORATION
    const { collabDir, gitRoot } = findCollabRoot(process.cwd());

    // 2b. 约定层配额（代谢机制）：加之前必须先减
    if (type === EntryKindValues.Agreement) {
        const loader = new FileWorkspaceLoader(collabDir);
        const active = extractIdsForKind(loader.load(), type).length;
        if (active >= AGREEMENT_LIMIT) {
            throw new Error(
                `约定已达上限（${active}/${AGREEMENT_LIMIT}）。` +
                    `约定是承重墙 —— 每加一条，都在向未来每一次交互收税。\n` +
                    `先处理一条：归档（status → dormant）／并入已有条目／删掉。\n` +
                    `若这一条确实不可谈判，它多半该改写成 工作流 / 模式 / 集成层 的模样。`,
            );
        }
    }

    // 3. 解析 id
  const idArg = positionals[1];
  let id: string;

  if (idArg !== undefined) {
    // 用户显式给 id —— 用领域层的权威校验
    const result = EntryId.create(idArg, type);
    if (!result.ok) {
      const issue = result.error;
      // D4：显示 suggestion（如果存在）
      const suffix = issue.suggestion ? `\n  → ${issue.suggestion}` : "";
      throw new Error(issue.message + suffix);
    }
    id = result.value;
  } else {
    // 自动生成 —— 内部保证合法，无需再校验
    const loader = new FileWorkspaceLoader(collabDir);
    const workspace = loader.load();
    const existingIds = extractIdsForKind(workspace, type);
    id = computeNextId(existingIds, type);
  }

    // 4. 检查文件已存在
    const relDir = EntryKindDir[type];
    const filePath = path.join(collabDir, relDir, `${id}.md`);
    if (fs.existsSync(filePath)) {
        throw new Error(`file already exists: ${path.relative(process.cwd(), filePath)}`);
    }

    // 5. 确定 author
    const authorOpt = values.author;
    const author =
        typeof authorOpt === 'string' && authorOpt.length
            ? authorOpt
            : readGitAuthor(gitRoot);
    if (!author) {
        throw new Error(
            'git user.name is not set. Run `git config user.name <your-name>` or pass --author.',
        );
    }

    // 6. 构建内容
    const content = await buildTemplate({ type, id, author });

    // 7. 写入（'wx' 保证不覆盖已存在文件——即使检查后被并发创建）
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, { encoding: 'utf8', flag: 'wx' });

    // 8. 输出
    const relPath = path.relative(process.cwd(), filePath);
    console.log(`✔ created ${relPath}`);
    console.log('');
    console.log('Next: run `collab index` to update the directory index.');
}

/**
 * 从 git 配置读取作者标识。
 *
 * @remarks
 * 顺序：`user.name` → `user.email`。
 * `author` 字段的语义是"**人**"（条目里写的是 `heiniao` 这样的名字，不是邮箱），
 * 所以 `user.name` 优先；邮箱只作兜底。
 *
 * @returns 作者标识，或 undefined（都没配 / 命令失败）
 */
function readGitAuthor(cwd: string): string | undefined {
    return readGitConfig(cwd, 'user.name') ?? readGitConfig(cwd, 'user.email');
}

/** 读取单个 git 配置项；未配置或命令失败返回 undefined。 */
function readGitConfig(cwd: string, key: string): string | undefined {
    try {
        const out = execFileSync('git', ['config', key], {
            cwd,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        const trimmed = out.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    } catch {
        return undefined;
    }
}
