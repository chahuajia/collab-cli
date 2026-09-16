/**
 * CLI 版本号的**唯一来源**。
 *
 * @remarks
 * 之前这个值散在三处（`--version` 打印 0.3.0、`package.json` 写 0.2.0、
 * MCP `serverInfo` 又需要一个）—— 三份真相源必然漂移。
 * 现在只在这里写一次；`package.json` 由人保持一致（发布时打 tag）。
 */
export const COLLAB_VERSION = "0.4.0";
