import { createHash } from "node:crypto";

/**
 * 计算字符串内容的 sha256（小写十六进制）。
 *
 * @remarks
 * 这是 `ContentHasher` 的**生产实现** —— 领域层只依赖函数签名，
 * 不知道用的是 sha256、blake3 还是别的。
 *
 * 显式 `utf8`：与 `fs.readFileSync(path, "utf8")` 的读取编码一致，
 * 否则"用同一份内容算出两个哈希"的 bug 会非常难查。
 *
 * @param content - 文本内容
 * @returns 64 位小写十六进制摘要
 */
export function sha256Hex(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}
