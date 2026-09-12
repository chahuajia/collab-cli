// src/domain/entry/Entry.ts
import type { Frontmatter } from './Frontmatter.js';

/**
 * 条目值对象：Frontmatter + body + path 的组合。
 *
 * @remarks
 * 不变量：
 * - `path` 与 `frontmatter.id` 的语义关系由外部规则校验（如 typeMatchesDir）。
 * - `body` 是 Markdown 正文（不含 frontmatter）。
 */
export class Entry {
    private constructor(
        private readonly _frontmatter: Frontmatter,
        private readonly _body: string,
        private readonly _path: string,
    ) {}

    static create(frontmatter: Frontmatter, body: string, path: string): Entry {
        return new Entry(frontmatter, body, path);
    }

    get frontmatter(): Frontmatter { return this._frontmatter; }
    get body(): string { return this._body; }
    get path(): string { return this._path; }
}