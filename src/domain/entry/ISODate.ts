// src/domain/entry/ISODate.ts

import  {Issue} from '@/domain/validation/Issue';
import {Ok, Err} from '@/shared/Result';
import type {Result} from '@/shared/Result'

/**
 * ISO 日期的品牌标签。
 *
 * @remarks
 * `declare const` 表示：编译期存在，运行时不存在。
 * 这样 `unique symbol` 可以作为 brand 的类型参数，
 * 而不产生运行时开销。
 */
declare const ISODateBrand: unique symbol;

/**
 * ISO 日期（YYYY-MM-DD）的类型。
 *
 * @remarks
 * 与裸 string 类型不兼容，防止误传。
 */
export type ISODate = string & { readonly [ISODateBrand]: true };

/**
 * ISODate 的工厂。
 *
 * @remarks
 * 不变量：
 * 1. 格式为 YYYY-MM-DD。
 * 2. 必须是真实存在的日期（拒绝 2026-02-30）。
 */
/**
 * ISO 日期（YYYY-MM-DD）的工厂。
 *
 * @remarks
 * 不变量：格式为 YYYY-MM-DD，且为真实存在的日期。
 * 使用 brand type 保证类型层面与裸 string 不可互换。
 */
export const ISODate = {
    create(raw: string): Result<ISODate, Issue> {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            return Err(Issue.invalidDate(raw));
        }
        const [y, m, d] = raw.split('-').map(Number);

        if (y === undefined || m === undefined || d === undefined) {
            return Err(Issue.invalidDate(raw));
        }

        const oneMonth = 1;
        const actualMonth = m - oneMonth;
        const date = new Date(Date.UTC(y, actualMonth, d));
        const valid =
            date.getUTCFullYear() === y &&
            date.getUTCMonth() === actualMonth &&
            date.getUTCDate() === d;
        return valid ? Ok(raw as ISODate) : Err(Issue.invalidDate(raw));
    },

    /**
     * 判断 a 是否晚于 b。
     *
     * @remarks
     * 依赖 ISO 8601 的字典序 = 时间序特性。
     * 若未来性能成为瓶颈，可改为时间戳比较。
     */
    isAfter(a: ISODate, b: ISODate): boolean {
        return a > b;
    },
} as const;