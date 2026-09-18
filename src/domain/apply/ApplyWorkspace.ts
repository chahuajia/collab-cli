/**
 * 文件在工作区中的当前状态。
 */
export interface FileFacts {
  readonly exists: boolean;
  /** 已存在文件内容的 sha256；不存在时为 null */
  readonly sha256: string | null;
}

/**
 * 按路径索引的工作区事实快照。
 *
 * @remarks
 * key 是"相对知识库根"的规范化路径（`normalizeBundlePath` 的产物）。
 */
export type WorkspaceFacts = ReadonlyMap<string, FileFacts>;

/**
 * 内容哈希函数（纯计算）。
 *
 * @remarks
 * 以函数形式注入（"How 可封装"）—— 领域层只声明"需要一个哈希"，
 * 具体算法由基础设施提供（`node:crypto`）。
 */
export type ContentHasher = (content: string) => string;

/**
 * 落盘通道契约。
 *
 * @remarks
 * 与 `WorkspaceLoader` 对称：领域层定义端口，基础设施提供实现。
 * 领域层因此不必 import `node:fs`，也不必知道路径如何拼接。
 *
 * 所有路径都是"相对知识库根"的规范化路径。
 */
export interface ApplyWorkspace {
  /** 只读地观察目标当前状态。 */
  inspect(relPath: string): FileFacts;
  /** 写入（或覆盖）文件；父目录按需创建。 */
  write(relPath: string, content: string): void;
  /** 删除文件。 */
  remove(relPath: string): void;
}
