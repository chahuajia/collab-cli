import { ApplyIssues } from "@/domain/apply/ApplyIssues";
import {
  AllowedBundleTopLevelDirs,
  MinBundlePathSegments,
} from "@/domain/apply/BundlePolicy";
import { Err, Ok } from "@/shared/Result";
import type { Issue } from "@/domain/validation/Issue";
import type { Result } from "@/shared/Result";

/** Windows 盘符前缀，如 `C:` —— 绝对路径的另一种形态。 */
const WINDOWS_DRIVE = /^[A-Za-z]:/;

/** AI 产出常见的仓库前缀 —— 见了就剥掉，不算错误。 */
const COLLAB_DIR_PREFIX = "COLLABORATION/";

const AllowedTopLevelDirs: ReadonlySet<string> = new Set(
  AllowedBundleTopLevelDirs,
);

/**
 * 校验并规范化 bundle 里的路径。
 *
 * @remarks
 * 规则（对应 spec §1 预检表）：
 * 1. 拒绝空路径。
 * 2. 拒绝绝对路径（`/x`、`C:\x`）—— **先于**剥前缀判断。
 * 3. 剥掉 `./` 与 `COLLABORATION/` 前缀（AI 常带）。
 * 4. 拒绝含 `..`、`.` 或空段的路径。
 * 5. 顶层目录必须在白名单内。
 * 6. 至少两段 —— 必须指向目录里的文件，而不是目录本身。
 *
 * 不做的事：不要求 `.md` 后缀，不检查文件是否真的存在
 * （存在性与冲突由 `resolvePlan` 负责）。
 *
 * @param raw - bundle 中声明的原始路径
 * @returns 成功返回"相对知识库根"的规范化路径（正斜杠）
 */
export function normalizeBundlePath(raw: string): Result<string, Issue> {
  if (raw.trim().length === 0) {
    return Err(ApplyIssues.unsafePath(raw, "path must not be empty"));
  }

  // 1. 统一分隔符 —— bundle 可能来自 Windows
  const unified = raw.replace(/\\/g, "/");

  // 2. 绝对路径：剥前缀之前判断，否则 `/COLLABORATION/x` 会被当成相对路径
  if (unified.startsWith("/") || WINDOWS_DRIVE.test(unified)) {
    return Err(ApplyIssues.unsafePath(raw, "absolute paths are not allowed"));
  }

  // 3. 剥前缀（可重复，如 `./COLLABORATION/x`）
  const stripped = stripKnownPrefixes(unified);

  // 4. 逐段检查
  const segments = stripped.split("/");
  for (const segment of segments) {
    if (segment === "..") {
      return Err(ApplyIssues.unsafePath(raw, 'path must not contain ".."'));
    }
    if (segment === "" || segment === ".") {
      return Err(
        ApplyIssues.unsafePath(raw, "path must not contain empty segments"),
      );
    }
  }

  // 5. 顶层目录白名单
  const top = segments[0];
  if (top === undefined || !AllowedTopLevelDirs.has(top)) {
    return Err(ApplyIssues.pathNotAllowed(raw));
  }

  // 6. 必须指向文件
  if (segments.length < MinBundlePathSegments) {
    return Err(
      ApplyIssues.unsafePath(raw, "path must point to a file, not a directory"),
    );
  }

  return Ok(segments.join("/"));
}

/**
 * 反复剥掉 `./` 与 `COLLABORATION/` 前缀。
 */
function stripKnownPrefixes(path: string): string {
  let result = path;
  for (;;) {
    if (result.startsWith("./")) {
      result = result.slice("./".length);
      continue;
    }
    if (result.startsWith(COLLAB_DIR_PREFIX)) {
      result = result.slice(COLLAB_DIR_PREFIX.length);
      continue;
    }
    return result;
  }
}
