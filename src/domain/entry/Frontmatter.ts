// domain/entry/Frontmatter.ts
import {EntryId} from "@/domain/entry/EntryId";
import {ISODate} from "@/domain/entry/ISODate";
import {Issue} from "@/domain/validation/Issue";
import {Ok, Err} from '@/shared/Result';
import type {FrontmatterInput} from './FrontmatterInput.js';
import type {EntryStatus, EntryKind} from "./types";
import type {Result} from '@/shared/Result.js';


/**
 * Frontmatter 值对象。
 *
 * @remarks
 * 组合多个值对象（EntryId, ISODate），由工厂 `create` 保证整体不变量。
 * 不使用 `new`，只能通过 `Frontmatter.create` 构造。
 */
export class Frontmatter {
  private constructor(
    private readonly _id: EntryId,
    private readonly _type: EntryKind,
    private readonly _status: EntryStatus,
    private readonly _created: ISODate,
    private readonly _updated: ISODate,
    private readonly _domains: readonly string[],
    private readonly _appliesTo: readonly string[],
    private readonly _supersedes: string | null,
    private readonly _coAuthors: readonly string[],
    private readonly _focus: readonly string[],
    private readonly _author: string,
    private readonly _provenance: string | undefined,
    private readonly _aliases: readonly string[],
    private readonly _trigger: string | undefined,
    private readonly _antiTrigger: string | undefined,
    private readonly _falsifier: string | undefined,
    private readonly _enforced: string | null,
  ) {}

  /**
   * 构造 Frontmatter。
   *
   * @remarks
   * 不变量：
   * 1. id 前缀必须匹配 type。
   * 2. created / updated 必须是真实 ISO 日期。
   * 3. created <= updated。
   */
  static create(input: FrontmatterInput): Result<Frontmatter, Issue[]> {
    const idResult = EntryId.create(input.id, input.type);
    const createdResult = ISODate.create(input.created);
    const updatedResult = ISODate.create(input.updated);

    const issues: Issue[] = [];
    if (!idResult.ok) issues.push(idResult.error);
    if (!createdResult.ok) issues.push(createdResult.error);
    if (!updatedResult.ok) issues.push(updatedResult.error);
    if (issues.length) return Err(issues);

    // 到这里，TS 仍然不知道三个结果都 ok（跨变量互斥不推导）
    // 所以用嵌套 if + 类型谓词，TS 会在这里收窄
    if (idResult.ok && createdResult.ok && updatedResult.ok) {
      if (ISODate.isAfter(createdResult.value, updatedResult.value)) {
        return Err([Issue.dateOrderInvalid(input.created, input.updated)]);
      }
      return Ok(
        new Frontmatter(
          idResult.value,
          input.type,
          input.status,
          createdResult.value,
          updatedResult.value,
          input.domains,
          input["applies-to"],
          input.supersedes,
          input["co-authors"],
          input.focus,
          input.author,
          input.provenance,
          input.aliases ?? [],
          input.trigger,
          input["anti-trigger"],
          input.falsifier,
          input.enforced,
        ),
      );
    }

    // TS 需要这里有个 return（即使逻辑上不可达）
    return Err(issues);
  }
  get id(): EntryId {
    return this._id;
  }

  get type(): EntryKind {
    return this._type;
  }

  get status(): EntryStatus {
    return this._status;
  }

  get created(): ISODate {
    return this._created;
  }

  get updated(): ISODate {
    return this._updated;
  }

  get domains(): readonly string[] {
    return this._domains;
  }

  get appliesTo(): readonly string[] {
    return this._appliesTo;
  }

  get supersedes(): string | null {
    return this._supersedes;
  }

  get author(): string | undefined {
    return this._author;
  }

  get coAuthors(): readonly string[] {
    return this._coAuthors;
  }

  get focus(): readonly string[] {
    return this._focus;
  }

  get provenance(): string | undefined {
    return this._provenance;
  }

  get aliases(): readonly string[] {
    return this._aliases;
  }

  /**
   * 什么时候**该**读这条（路由字段）。
   *
   * @remarks
   * 由人/模型写 —— **工具生成不出来**。它回答的是"什么情况下我该被翻到"。
   */
  get trigger(): string | undefined {
    return this._trigger;
  }

  /**
   * 什么时候**不用**读这条（反触发）。
   *
   * @remarks
   * 防误用：一条规则被读错场景，比不被读更糟。
   */
  get antiTrigger(): string | undefined {
    return this._antiTrigger;
  }

  /**
   * 不读它，模型会照着**本地哪个模式**写错？
   *
   * @remarks
   * 入库门槛字段。必须是模仿类反事实（"会照着眼前这段坏代码继续写"），
   * 不是无知类（"模型不知道 X"——D 实验已六跑证伪）。
   */
  get falsifier(): string | undefined {
    return this._falsifier;
  }

  /**
   * 已把这条内容机械化的测试/工具/规则的路径。非空 = 已毕业。
   *
   * @remarks
   * 毕业 ⇒ 退出路由索引（见 `routed.ts` 的 `isRouted`）。
   * 这是"条目 → 测试"输送带的终点：内容活在测试里，不必再被人读。
   */
  get enforced(): string | null {
    return this._enforced;
  }
}
