import { parseArgs } from "node:util";
import { standardRules, ValidateUseCase } from "@/application/ValidateUseCase";
import { Issue } from "@/domain/validation/Issue";
import { ValidationReport } from "@/domain/validation/ValidationReport";
import { resolveEnforced } from "@/infrastructure/fs/enforcedTargets";
import { FileWorkspaceLoader } from "@/infrastructure/fs/FileWorkspaceLoader";
import { findCollabRoot } from "@/infrastructure/fs/findCollabRoot";
import {
  renderHumanReport,
  renderJsonReport,
} from "@/infrastructure/report/renderReport";
import type { Entry } from "@/domain/entry/Entry";


/**
 * `collab validate [--json]`
 *
 * 校验当前 git 仓库根下的 COLLABORATION 工作区。
 *
 * @remarks
 * 退出码：
 * - 0：无阻断性 Issue（可能有 warning）
 * - 1：有 error（**参数错误也走 1**）
 *
 * @remarks
 * 这里曾写"2：参数错误" —— 但**代码里从来没有出现过退出码 2**
 * （参数用 `strict: false` 解析，未知选项被静默忽略）。
 * 文档承诺不存在的行为，比不写更糟：它会让调用方去处理一个永远不会到来的分支。
 */
export async function cmdValidate(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      json: { type: "boolean", default: false },
      "check-enforced": { type: "boolean", default: false },
    },
    strict: false,
  });

  const { collabDir } = findCollabRoot(process.cwd());

  const loader = new FileWorkspaceLoader(collabDir);
  const useCase = new ValidateUseCase(loader, standardRules);

  const { entries, report } = useCase.execute();

  // 可选：复查已毕业条目的 `enforced` 目标是否**还在**。
  //
  // 与默认校验分开，因为它要**读跨仓文件系统** —— 会破坏 validate 的密闭性
  // （在拿不到那个业务仓的机器上会全红，于是这条检查会被关掉，
  // 然后真正的漂移也没人看了）。所以：显式 opt-in，且"无法判定"不算错。
  const hasEnforcedCheck = values["check-enforced"] === true;
  const finalReport = hasEnforcedCheck
    ? withEnforcedTargets(report, entries.filter((e) => e !== null))
    : report;

  if (values.json) {
    process.stdout.write(renderJsonReport(finalReport, entries.length));
  } else {
    const useColor = process.stdout.isTTY;
    process.stdout.write(
      renderHumanReport(finalReport, entries.length, { useColor }),
    );
  }

  if (finalReport.hasBlocking()) {
    process.exit(1);
  }
}

/**
 * 追查 `enforced` 的目标是否存在。
 *
 * @remarks
 * **三态**：存在 / 不存在 / **无法判定**（仓名不认识、本机没那个仓）。
 * 只有"不存在"报错 —— 把"无法判定"当"不存在"会制造假阳性，
 * 而假阳性会让这条检查被无视（[[patterns/policy-without-mechanism]]）。
 */
function withEnforcedTargets(
  report: ValidationReport,
  entries: readonly Entry[],
): ValidationReport {
  const issues = entries.flatMap((entry) => {
    const value = entry.frontmatter.enforced;
    if (value === null) return [];

    const r = resolveEnforced(value);
    if (r.kind === "unresolvable" || r.exists) return [];

    return [Issue.enforcedTargetMissing(entry.path, value, r.abs)];
  });

  return issues.length === 0
    ? report
    : ValidationReport.of([...report.issues, ...issues]);
}
