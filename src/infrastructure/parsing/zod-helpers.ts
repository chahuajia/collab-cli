// src/shared/zod-helpers.ts
import { z } from 'zod';
import type { ValueOf } from '@/shared/types';

/**
 * 从 const object 生成 zod enum。
 *
 * @remarks
 * 注意：zod 内部要求 mutable 数组，所以这里不能用 readonly。
 * 与类型层的 `NonEmptyArray` 不同，这个是专为 zod 而设。
 */
export function enumOf<T extends Record<string, string>>(
    obj: T,
): z.ZodEnum<[ValueOf<T>, ...ValueOf<T>[]]> {
    const values = Object.values(obj) ;
    // @ts-ignore
    return z.enum(values);
}