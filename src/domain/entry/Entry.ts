// src/domain/entry/Entry.ts
import type { Frontmatter } from './Frontmatter.js';

/**
 * COLLABORATION 中的一条条目。
 *
 * @remarks
 * **语义定义**：一条"结构化的、有身份的、可独立校验的知识条目"。
 * 例子：A8（约定）、S12（技能）、W7（工作流）。
 *
 * **不是**：
 * - 不是 webpack/bundler 的 "entry point"。
 * - 不是 Java 的 `Map.Entry`（键值对）。
 * - 不是 DDD 的 Entity（实体）——Entry 是值对象，无独立身份。
 *
 * **是什么**：
 * - 是"目录条目"意义上的 entry（catalog entry）。
 * - 是 COLLABORATION 系统中最小的可校验单元。
 * - 由 `Frontmatter`（元数据）+ `body`（内容）+ `path`（位置）组成。
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