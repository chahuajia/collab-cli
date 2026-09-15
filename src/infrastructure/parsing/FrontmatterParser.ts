// src/infrastructure/parsing/FrontmatterParser.ts
import YAML from "yaml";
import { z } from "zod";
import {
  allowedStatusesFor,
  EntryKindValues,
  type EntryStatus,
} from "@/domain/entry/types";
import { Issue } from "@/domain/validation/Issue";
import { enumOf } from "@/infrastructure/parsing/zod-helpers";
import { Err, Ok } from "@/shared/Result";
import type { FrontmatterInput } from "@/domain/entry/FrontmatterInput";
import type { Result } from "@/shared/Result";

const MIN_LENGTH = 1;
const Schema = z
  .object({
    id: z.string().min(MIN_LENGTH),
    type: enumOf(EntryKindValues),
    status: z.custom<EntryStatus>(
      (val) => typeof val === "string" && val.length,
      { message: "status must be a non-empty string" },
    ),
    created: z.string(),
    updated: z.string(),
    domains: z.array(z.string()).default([]),
    "applies-to": z.array(z.string()).default([]),
    supersedes: z.string().nullable().default(null),
    "co-authors": z.array(z.string()).default([]),
    focus: z.array(z.string()).default([]),
    aliases: z.array(z.string()).optional(),
    author: z
      .string()
      .min(MIN_LENGTH, "author is required and must not be empty"),
    provenance: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const allowed = allowedStatusesFor(data.type);
    if (!allowed.includes(data.status)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["status"],
        message: `Invalid enum value. Expected ${allowed
          .map((s) => `'${s}'`)
          .join(" | ")}, received '${data.status}'`,
      });
    }
  });

/**
 * 解析原始 frontmatter 为 FrontmatterInput。
 *
 * @remarks
 * **唯一返回 FrontmatterInput 的地方**。
 * 只做形状校验（类型、格式、枚举成员），不做业务不变量校验。
 * 业务不变量由 `Frontmatter.create` 负责。
 *
 * @param raw - 原始 YAML 解析结果
 * @param path - 文件路径，用于错误定位
 * @returns 成功返回 FrontmatterInput，失败返回 Issue 数组
 */
export function parseFrontmatterInput(
  raw: unknown,
  path: string,
): Result<FrontmatterInput, Issue[]> {
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) {
    return Err(
      parsed.error.issues.map((i) =>
        Issue.invalidShape(path, `${i.path.join(".")}: ${i.message}`),
      ),
    );
  }
  return Ok(parsed.data);
}

/**
 * 分离后的 Markdown 文档。
 */
export interface ParsedDocument {
  readonly frontmatterRaw: unknown;
  readonly body: string;
}

/**
 * `parseDocument` 的错误类型。
 */
export type DocumentParseError =
  | { readonly kind: "missing-frontmatter" }
  | { readonly kind: "unclosed-frontmatter" }
  | { readonly kind: "invalid-yaml"; readonly reason: string };

const BOM_CODE_POINT = 0xfeff;
/**
 * 分离 Markdown 文档的 frontmatter 和 body。
 *
 * @remarks
 * 格式约定：
 * - 文件必须以 `---` 行开头（允许 BOM 前缀 `\uFEFF`）
 * - frontmatter 与 body 之间由独占一行的 `---` 分隔
 * - 兼容 Unix (`\n`) 与 Windows (`\r\n`) 换行
 * - frontmatter 必须解析为 YAML 映射（对象），不能是字符串/数组/标量
 *
 * 不负责：
 * - frontmatter 的具体字段校验（那是 `parseFrontmatterInput` 的职责）
 * - 嵌套/多块 frontmatter
 * - 代码块内的 `---` 识别（当前实现按行首匹配，与 sectionsPresent D7 一致）
 *
 * @param raw - 文件的完整内容
 * @returns 成功时返回 `{ frontmatterRaw, body }`；失败时返回 `DocumentParseError`
 */
export function parseDocument(
  raw: string,
): Result<ParsedDocument, DocumentParseError> {
  // 1. 去掉 BOM
  const text = raw.charCodeAt(0) === BOM_CODE_POINT ? raw.slice(1) : raw;

  // 2. 按行分割（兼容 \n 与 \r\n）
  const lines = text.split(/\r?\n/);

  // 3. 第一行必须是 `---`
  if (lines[0] !== "---") {
    return Err({ kind: "missing-frontmatter" });
  }

  // 4. 找结束的 `---` 行
  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---") {
      endIndex = i;
      break;
    }
  }
  if (endIndex === -1) {
    return Err({ kind: "unclosed-frontmatter" });
  }

  // 5. 分离 YAML 与 body
  const yamlText = lines.slice(1, endIndex).join("\n");
  const body = lines.slice(endIndex + 1).join("\n");

  // 6. 解析 YAML
  let parsed: unknown;
  try {
    parsed = YAML.parse(yamlText);
  } catch (e) {
    return Err({
      kind: "invalid-yaml",
      reason: e instanceof Error ? e.message : String(e),
    });
  }

  // 7. 必须是映射（非 null/undefined/数组/标量）
  if (
    parsed === null ||
    parsed === undefined ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    return Err({
      kind: "invalid-yaml",
      reason: "frontmatter must be a YAML mapping",
    });
  }

  return Ok({ frontmatterRaw: parsed, body });
}
