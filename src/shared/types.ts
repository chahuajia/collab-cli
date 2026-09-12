/**
 * 从对象类型提取所有值的联合类型。
 * @remarks
 * 避免在多个地方手写联合类型（如 `'a' | 'b' | 'c'`），
 * 从而保持"定义"（const object）与"类型"的单一真相来源。
 *
 * - 与 TS 原生 `keyof` / 索引访问组合，足够简单
 * - 一旦 const object 增加成员，联合类型自动扩展
 *
 * @typeParam T - 任意对象类型
 * @example
 * ```ts
 * const Foo = { a: 'a', b: 'b' } as const;
 * type FooValues = ValueOf<typeof Foo>; // 'a' | 'b'
 * ```
 * @see NonEmptyArray
 * @see enumOf
 */
export type ValueOf<T> = T[keyof T];

/**
 * 至少含有一个元素的数组（非空元组）。
 *
 * @remarks
 * 用于需要"至少一个"语义的场合，如 zod 的 enum 构造。
 * 与 `T[]` 的区别：`T[]` 允许为空，`NonEmptyArray<T>` 编译期强制非空。
 *
 * @typeParam T - 元素类型
 */
export type NonEmptyArray<T> = readonly [T, ...T[]];

/**
 * 给基础类型附加名义标签，防止结构相同的类型互相混淆。
 *
 * @remarks
 * TypeScript 是结构化类型系统，`string` 无法区分"EntryId"和"EmailAddress"。
 * Branded Type 通过添加一个不可能构造的 `__brand` 字段，让它们成为不同类型。
 *
 * @typeParam T - 基础类型
 * @typeParam B - 标签名（字符串字面量）
 *
 * @example
 * ```ts
 * type UserId = Brand<string, 'UserId'>;
 * type OrderId = Brand<string, 'OrderId'>;
 * // const o: OrderId = someUserId; // 编译错误
 * ```
 */
export type Brand<T, B extends Symbol> = T & { readonly __brand: B };

/*export declare const ISODateBrand: unique symbol;
export type ISODate = string & { readonly [ISODateBrand]: true };

export function createBrand<T, B extends Symbol>(value: T): Brand<T, B> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return value as Brand<T, B>;
}*/
