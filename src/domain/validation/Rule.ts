// src/domain/validation/Rule.ts
import type {Issue} from "./Issue";
import type {Entry} from "../entry/Entry";

/**
 * 校验规则。
 *
 * @remarks
 * 每条规则是一个纯函数：输入 Entry，输出 Issue 数组。
 * 无副作用、无状态、可独立测试。
 */
export type Rule = (entry: Entry, context: RuleContext) => readonly Issue[];

/**
 * 规则运行的上下文。
 *
 * @remarks
 * 用于跨条目的规则（如 deadLink 需要看全部条目）。
 */
export interface RuleContext {
    readonly allEntryIds: ReadonlySet<string>;
    readonly allEntries: readonly Entry[];
}