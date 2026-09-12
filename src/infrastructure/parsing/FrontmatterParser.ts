// src/infrastructure/parsing/FrontmatterParser.ts

import { z } from 'zod';
import {EntryStatusValues, EntryTypeValues} from "@/domain/entry/types";
import {Issue} from "@/domain/validation/Issue";
import {enumOf} from "@/infrastructure/parsing/zod-helpers";
import {Err, Ok} from "@/shared/Result";
import type{ FrontmatterInput} from "@/domain/entry/FrontmatterInput";
import type {Result} from "@/shared/Result";

const MIN_ID_LENGTH = 1;
const Schema = z.object({
    id: z.string().min(MIN_ID_LENGTH),
    type: enumOf(EntryTypeValues),
    status: enumOf(EntryStatusValues),
    created: z.string(),
    updated: z.string(),
    domains: z.array(z.string()).optional(),
    'applies-to': z.array(z.string()).optional(),
    supersedes: z.string().nullable().optional(),
    author: z.string().optional(),
    'co-authors': z.array(z.string()).optional(),
    focus: z.array(z.string()).optional(),
    provenance: z.string().optional(),
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
                Issue.invalidShape(path, `${i.path.join('.')}: ${i.message}`),
            ),
        );
    }
    return Ok(parsed.data);
}