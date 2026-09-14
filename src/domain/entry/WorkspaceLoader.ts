// src/domain/entry/WorkspaceLoader.ts
import type {Entry} from "@/domain/entry/Entry";
import type{ Issue} from "@/domain/validation/Issue";

/**
 * 工作区中的一个已加载条目。
 *
 * @remarks
 * `entry` 为 null 表示解析阶段失败，`parseIssues` 非空。
 */
export interface LoadedEntry {
    readonly path: string;
    readonly entry: Entry | null;
    readonly parseIssues: readonly Issue[];
}

/**
 * 工作区快照。
 */
export interface Workspace {
  readonly entries: readonly LoadedEntry[];
  readonly indexFiles: ReadonlyMap<string, string>;
  readonly allMarkdownPaths: ReadonlySet<string>;
}

/**
 * 工作区加载器契约。
 *
 * @remarks
 * 只负责加载，不负责校验。
 * 校验逻辑由 ValidateUseCase 注入的 Rule[] 提供。
 */
export interface WorkspaceLoader {
    load(): Workspace;
}