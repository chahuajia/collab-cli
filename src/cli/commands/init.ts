import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { buildCatalog, serializeCatalog } from "@/application/buildCatalog";
import {
  buildConsumerPlan,
  buildInitPlan,
  writeInitPlan,
} from "@/application/InitUseCase";
import { ValidateUseCase } from "@/application/ValidateUseCase";
import { FileWorkspaceLoader } from "@/infrastructure/fs/FileWorkspaceLoader";
import { COLLAB_NPM_RANGE } from "@/infrastructure/version";

/**
 * 支持的 profile。
 *
 * @remarks
 * - `consumer`（默认）：项目侧接入**全局唯一**的 KB —— 生成入口 + WM 骨架 +
 *   对全局 KB 跑校验的 wrapper。项目侧**不建 KB**。
 * - `kb`：真的新建一个独立知识库（罕见；多数情况是 fork，不是 init）。
 *
 * 未知值必须报错，不能静默降级 —— 打错字就装错东西是最难查的故障形态。
 */
export const SUPPORTED_PROFILES = ["consumer", "kb"] as const;

const CI_YML = [
  "name: Validate",
  "",
  "on:",
  "  push:",
  "  pull_request:",
  "  workflow_dispatch:",
  "",
  "jobs:",
  "  validate:",
  "    runs-on: ubuntu-latest",
  "    steps:",
  "      - uses: actions/checkout@v4",
  "      - uses: actions/setup-node@v4",
  "        with:",
  "          node-version: 20",
  "      # 唯一调用点：CLI 来源的差异都收在 scripts/collab-validate.mjs 里",
  "      - run: node scripts/collab-validate.mjs",
  "",
].join("\n");

const HOOK_SH = [
  "#!/bin/sh",
  "# 唯一调用点（与 CI 同一处）",
  "node scripts/collab-validate.mjs",
  "",
].join("\n");

/**
 * `collab init [--profile consumer|kb] [--kb <path>] [--with-ci] [--with-hook] [--dry-run] [--json]`
 *
 * 把一个空目录变成"门禁已接、账本已建、入口已写"的最小可运行工作区。
 *
 * @remarks
 * 决策落地：
 * - **只增不改**：已存在的文件一律跳过，永不覆盖（脚手架吃掉用户改动是最常见的破坏行为）。
 * - **不用向上查找定位工作区**：此刻还不存在知识库，向上找必然失败。只认 `--dir`（已进
 *   `COLLAB_DIR`），否则用当前目录。
 * - **自检复用 `ValidateUseCase`**：不重写规则，否则规则会有两份。
 */
export async function cmdInit(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      profile: { type: "string", default: "consumer" },
      kb: { type: "string" },
      "with-ci": { type: "boolean", default: false },
      "with-hook": { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      json: { type: "boolean", default: false },
    },
    strict: false,
  });

  const profile =
    typeof values.profile === "string" ? values.profile : "consumer";
  if (!SUPPORTED_PROFILES.some((p) => p === profile)) {
    console.error(
      `✖ 未知 --profile: ${profile}（目前只支持 ${SUPPORTED_PROFILES.join(" / ")}）`,
    );
    process.exit(1);
  }

  const collabDir = process.env.COLLAB_DIR ?? process.cwd();
  const ISO_DATE_LENGTH = 10;
  const today = new Date().toISOString().slice(0, ISO_DATE_LENGTH);
  const kb =
    typeof values.kb === "string" && values.kb.length > 0
      ? path.resolve(values.kb)
      : null;
  const plan =
    profile === "consumer"
      ? buildConsumerPlan({ collabDir, today, kb })
      : buildInitPlan({ collabDir, today });

  if (values["dry-run"] === true) {
    console.log(
      `collab init（dry-run）· profile=${profile} · 目标 ${collabDir}`,
    );
    for (const f of plan.files) console.log(`  + ${f.path}`);
    for (const s of plan.skipped) console.log(`  = ${s}（已存在，跳过）`);
    return;
  }

  fs.mkdirSync(collabDir, { recursive: true });
  writeInitPlan(collabDir, plan);
  for (const s of plan.skipped) console.log(`  = ${s}（已存在，跳过）`);
  for (const f of plan.files) console.log(`  + ${f.path}`);

  // 门禁要有**校验目标**才成立：没有 wrapper（= 没给 --kb）就不接线，并且**出声**。
  // 静默跳过等于假装接线了 —— 那正是这套系统反复删掉的那类失效。
  const gateReady = fs.existsSync(
    path.join(collabDir, "scripts", "collab-validate.mjs"),
  );
  if (
    !gateReady &&
    (values["with-hook"] === true || values["with-ci"] === true)
  ) {
    console.log(
      "  ! 跳过 CI/hook 接线 —— 门禁要有校验目标才成立：kb profile 不带门禁脚本（请在 CI 里直接调 npx --yes @chahuajia/collab-cli@" +
        COLLAB_NPM_RANGE +
        " validate --dir .）；consumer 需要 --kb。",
    );
  }

  // 可选：husky hook（没有 .husky/ 就跳过并说明，不算失败）
  if (values["with-hook"] === true && gateReady) {
    const huskyDir = path.join(collabDir, ".husky");
    if (!fs.existsSync(huskyDir)) {
      console.log(
        "  ! 未找到 .husky/ —— 跳过 pre-push。先 `npx husky init`，再接 `node scripts/collab-validate.mjs`",
      );
    } else {
      const hookPath = path.join(huskyDir, "pre-push");
      if (fs.existsSync(hookPath)) {
        console.log("  = .husky/pre-push（已存在，跳过）");
      } else {
        fs.writeFileSync(hookPath, HOOK_SH, "utf8");
        console.log("  + .husky/pre-push");
      }
    }
  }

  // 可选：CI
  if (values["with-ci"] === true && gateReady) {
    const ciPath = path.join(collabDir, ".github", "workflows", "validate.yml");
    if (fs.existsSync(ciPath)) {
      console.log("  = .github/workflows/validate.yml（已存在，跳过）");
    } else {
      fs.mkdirSync(path.dirname(ciPath), { recursive: true });
      fs.writeFileSync(ciPath, CI_YML, "utf8");
      console.log("  + .github/workflows/validate.yml");
    }
  }

  // 生成物与自检**只对 `kb` profile 有意义**：consumer 侧没有知识库，
  // 给它写一个 catalog.json 会凭空造出「假 KB 产物」。
  if (profile === "kb") {
    // 生成物：catalog 由命令生成，不手写
    const catalog = buildCatalog(new FileWorkspaceLoader(collabDir).load(), {
      generatedAt: new Date().toISOString(),
    });
    fs.writeFileSync(
      path.join(collabDir, "catalog.json"),
      serializeCatalog(catalog),
      "utf8",
    );

    // 自检：复用标准规则
    const { report } = new ValidateUseCase(
      new FileWorkspaceLoader(collabDir),
    ).execute();
    if (report.issues.length > 0) {
      console.error(
        `✖ init 已写入，但自检未通过：${report.issues.length} 个问题`,
      );
      console.error(
        "  下一步：`collab validate` —— 看完整清单（kb profile 不生成 wrapper 脚本）",
      );
      process.exit(1);
    }
  }

  console.log("");
  console.log(
    profile === "kb"
      ? `✔ init 完成（profile=kb）· 自检 0 issues`
      : `✔ init 完成（profile=consumer）· 项目侧骨架已就绪（未建 KB）`,
  );
  console.log("  下一步：");
  console.log(
    profile === "kb"
      ? "    1. 把 AGENTS.md 里的三行症状表换成你自己的"
      : "    1. 把 AGENTS.md 里的 <全局 KB 路径> 换成真的（或用 --kb 重跑）",
  );
  // 只指**真实存在**的下一步：wrapper 仅 consumer + --kb 才有（见上面 gateReady）。
  // 让人去跑一个没生成的脚本，和死链同罪 —— 这条已踩过一次（kb profile 曾承诺 wrapper）。
  console.log(gateReady
    ? "    2. node scripts/collab-validate.mjs（或在 CI / pre-push 里接它）"
    : profile === "kb"
      ? "    2. 门禁：CI / pre-push 里直接调 `npx --yes @chahuajia/collab-cli@" +
        COLLAB_NPM_RANGE +
        " validate`（kb profile 不生成 wrapper 脚本）"
      : "    2. 用 `--kb <全局 KB 路径>` 重跑才会生成 `scripts/collab-validate.mjs` —— 没有校验目标时门禁不接线");
  console.log(
    "    3. 第一条新条目必须能说出「不读它，模型会照着本地哪个模式写错」",
  );
}
