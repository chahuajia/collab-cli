/**
 * 显式表达"成功或失败"的结果类型。
 *
 * @remarks
 * - Discriminated Union 让 TS 能窄化 `if (r.ok)`。
 * - 相比异常，类型系统强制调用方处理失败。
 * - 相比 `{ data, error }`，不允许"同时有 data 和 error"。
 *
 * @typeParam T - 成功值类型
 * @typeParam E - 失败原因类型
 */
export type Result<T, E> =
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly error: E };

/**
 * 构造成功结果。
 *
 * @typeParam T - 成功值类型
 * @param value - 成功值
 */
export const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

/**
 * 构造失败结果。
 *
 * @typeParam E - 失败原因类型
 * @param error - 失败原因
 */
export const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });
