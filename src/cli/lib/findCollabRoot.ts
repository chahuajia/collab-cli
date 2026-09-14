// src/cli/lib/findCollabRoot.ts
import fs from 'node:fs';
import path from 'node:path';

export interface CollabRoot {
    readonly collabDir: string;
    readonly gitRoot: string;
}

/**
 * 从 `startDir` 向上查找 git 仓库根目录，并确认其下有 COLLABORATION/。
 *
 * @remarks
 * 与 git 命令相同的惯例：向上找 `.git`。
 * 找到后要求同级有 `COLLABORATION/`，否则报错。
 *
 * @throws 当不在 git 仓库中，或 git 仓库根没有 COLLABORATION/ 时
 */
export function findCollabRoot(startDir: string): CollabRoot {
    let dir = path.resolve(startDir);
    while (true) {
        if (fs.existsSync(path.join(dir, '.git'))) {
            const collabDir = path.join(dir, 'COLLABORATION');
            if (!fs.existsSync(collabDir)) {
                throw new Error(
                    `no COLLABORATION/ directory found at ${dir}. Create it first.`,
                );
            }
            return { collabDir, gitRoot: dir };
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            throw new Error('not inside a git repository. Run `git init` first.');
        }
        dir = parent;
    }
}