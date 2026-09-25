import { describe, expect, it } from "vitest";
import {
  AGREEMENT_LIMIT,
  agreementQuotaExceeded,
} from "@/domain/entry/agreementQuota";

/**
 * 约定层的代谢门。
 *
 * @remarks
 * 这条规则原先埋在 `cli/commands/new.ts` 的 `if` 里 —— 于是它既不能被单测直接钉住，
 * 也不属于任何一层。提取成 domain 函数之后，边界值可以**在这里**测，不必起 CLI。
 */
describe("agreementQuotaExceeded", () => {
  it("未满：放行", () => {
    expect(agreementQuotaExceeded(0)).toBeNull();
    expect(agreementQuotaExceeded(AGREEMENT_LIMIT - 1)).toBeNull();
  });

  it("正好到上限：拒绝，并给出**出路**而不是只说不行", () => {
    const message = agreementQuotaExceeded(AGREEMENT_LIMIT);
    expect(message).not.toBeNull();
    expect(message).toContain(`${AGREEMENT_LIMIT}/${AGREEMENT_LIMIT}`);
    expect(message).toContain("collab retire"); // 先减再加：必须告诉人怎么腾位置
  });
});
