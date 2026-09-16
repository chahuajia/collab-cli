import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { buildCatalog, serializeCatalog } from "@/application/buildCatalog";
import { findCollabRoot } from "@/cli/lib/findCollabRoot";
import { FileWorkspaceLoader } from "@/infrastructure/fs/FileWorkspaceLoader";

/** 默认输出文件名（写在知识库根）。 */
const DEFAULT_OUT = "catalog.json";

/**
 * `collab catalog [--out <path>] [--stdout]`
 *
 * 从工作区**生成** `catalog.json` —— agent 的路由表。
 *
 * @remarks
 * 决策落地：
 * - **生成，不手写**：手写的索引是第二份真相源，必然漂移。
 * - 默认写到知识库根；`--stdout` 只打印不落盘。
 * - 不校验内容（那是 `validate` 的事）—— 本命令只做投影。
 */
export async function cmdCatalog(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      out: { type: "string" },
      stdout: { type: "boolean", default: false },
    },
    strict: false,
  });

  const { collabDir } = findCollabRoot(process.cwd());
  const workspace = new FileWorkspaceLoader(collabDir).load();
  const catalog = buildCatalog(workspace, {
    generatedAt: new Date().toISOString(),
  });

  if (values.stdout === true) {
    process.stdout.write(serializeCatalog(catalog));
    return;
  }

  const outArg = values.out;
  const outPath = path.resolve(
    collabDir,
    typeof outArg === "string" && outArg.length > 0 ? outArg : DEFAULT_OUT,
  );
  fs.writeFileSync(outPath, serializeCatalog(catalog), "utf8");

  console.log(
    `✔ catalog: ${catalog.summary.total} entries → ${path.relative(
      process.cwd(),
      outPath,
    )}`,
  );
}
