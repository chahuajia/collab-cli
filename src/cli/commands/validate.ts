import { parseArgs } from "node:util";
import { standardRules, ValidateUseCase } from "@/application/ValidateUseCase";
import { findCollabRoot } from "@/cli/lib/findCollabRoot";
import { FileWorkspaceLoader } from "@/infrastructure/fs/FileWorkspaceLoader";
import {
  renderHumanReport,
  renderJsonReport,
} from "@/infrastructure/report/renderReport";


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
    },
    strict: false,
  });

  const { collabDir } = findCollabRoot(process.cwd());

  const loader = new FileWorkspaceLoader(collabDir);
  const useCase = new ValidateUseCase(loader, standardRules);

  const { entries, report } = useCase.execute();

  if (values.json) {
    process.stdout.write(renderJsonReport(report, entries.length));
  } else {
    const useColor = process.stdout.isTTY;
    process.stdout.write(
      renderHumanReport(report, entries.length, { useColor }),
    );
  }

  if (report.hasBlocking()) {
    process.exit(1);
  }
}
