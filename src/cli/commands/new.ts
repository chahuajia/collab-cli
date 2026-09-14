// src/cli/commands/new.ts
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from "node:util";
import { findCollabRoot } from "@/cli/lib/findCollabRoot";
import { generateNextId } from "@/cli/lib/generateId";
import { buildTemplate } from "@/cli/lib/templates";
import {
  type EntryKind,
  EntryKindDir,
  EntryKindValues,
  EntryPrefix,
} from "@/domain/entry/types";


/**
 * CLI 接受的 `<type>` 字符串到领域 EntryKind 的映射。
 */
const VALID_TYPES: Record<string, EntryKind> = {
    skill: EntryKindValues.Skill,
    workflow: EntryKindValues.Workflow,
    agreement: EntryKindValues.Agreement,
    pattern: EntryKindValues.Pattern,
    adr: EntryKindValues.Adr,
};

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

    // 3. 解析 id
    const idArg = positionals[1];
    validateExplicitId(idArg, type);
    const id = idArg ?? generateNextId(collabDir, type);

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
            : readGitEmail(gitRoot);
    if (!author) {
        throw new Error(
            'git user.email is not set. Run `git config user.email <your@email>` or pass --author.',
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
 * 若用户显式传入 id，校验其前缀是否匹配类型。
 *
 * @remarks
 * pattern 类型的前缀为空字符串，跳过校验。
 */
function validateExplicitId(id: string | undefined, type: EntryKind): void {
    if (!id) return;
    const prefix = EntryPrefix[type];
    if (prefix === '') return;
    if (!id.startsWith(prefix)) {
        throw new Error(
            `id "${id}" must start with "${prefix}" for type "${type}"`,
        );
    }
}

/**
 * 从 git 配置读取 user.email。
 *
 * @returns 邮箱，或 undefined（未配置 / 命令失败）
 */
function readGitEmail(cwd: string): string | undefined {
    try {
        const out = execFileSync('git', ['config', 'user.email'], {
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