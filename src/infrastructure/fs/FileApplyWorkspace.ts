import fs from "node:fs";
import path from "node:path";
import { sha256Hex } from "@/infrastructure/crypto/sha256";
import type { ApplyWorkspace, FileFacts } from "@/domain/apply/ApplyWorkspace";

/**
 * 基于真实文件系统的 `ApplyWorkspace` 实现。
 *
 * @remarks
 * 路径拼接集中在此处 —— 领域层只传"相对知识库根"的规范化路径。
 * 因为路径已由 `normalizeBundlePath` 保证不含 `..` 且在白名单内，
 * 这里不再重复校验（规则只有一份，见 A10 "规格优先"）。
 */
export class FileApplyWorkspace implements ApplyWorkspace {
  constructor(private readonly collabDir: string) {}

  inspect(relPath: string): FileFacts {
    const abs = path.join(this.collabDir, relPath);
    if (!fs.existsSync(abs)) {
      return { exists: false, sha256: null };
    }
    return { exists: true, sha256: sha256Hex(fs.readFileSync(abs, "utf8")) };
  }

  write(relPath: string, content: string): void {
    const abs = path.join(this.collabDir, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf8");
  }

  remove(relPath: string): void {
    fs.rmSync(path.join(this.collabDir, relPath));
  }
}
