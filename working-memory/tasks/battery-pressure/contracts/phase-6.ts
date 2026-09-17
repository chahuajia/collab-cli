/**
 * 阶段 6 契约：信用 · 先用后付
 *
 * 依赖 phase-0 OrderId/Entitlement · phase-2 BALANCE 还款
 */

import type { MoneyCents, OrderId, UserId, ProductId } from "./phase-0.js";
import type { EntitlementStatus } from "./phase-0.js";

export type DebtId = string & { readonly __brand: "DebtId" };
export type StatementId = string & { readonly __brand: "StatementId" };
export type PolicyId = string & { readonly __brand: "PolicyId" };

export const CreditStatusValues = {
  Good: "good",
  Overdue: "overdue",
  Frozen: "frozen",
} as const;
export type CreditStatus =
  (typeof CreditStatusValues)[keyof typeof CreditStatusValues];

export type ScoreTier = "A" | "B" | "C";

export interface CreditProfile {
  readonly userId: UserId;
  readonly creditLimit: MoneyCents;
  readonly usedCredit: MoneyCents;
  readonly status: CreditStatus;
  readonly scoreTier: ScoreTier;
  readonly policyVersion: number;
}

export const DebtStatusValues = {
  Open: "OPEN",
  Billed: "BILLED",
  Paid: "PAID",
  WrittenOff: "WRITTEN_OFF",
} as const;
export type DebtStatus =
  (typeof DebtStatusValues)[keyof typeof DebtStatusValues];

export interface CreditLedgerDebt {
  readonly id: DebtId;
  readonly userId: UserId;
  readonly orderId: OrderId;
  readonly amount: MoneyCents;
  readonly status: DebtStatus;
  readonly createdAt: string;
  readonly billedStatementId?: StatementId;
  readonly paidAt?: string;
}

export const StatementStatusValues = {
  Open: "OPEN",
  Due: "DUE",
  Paid: "PAID",
  Overdue: "OVERDUE",
} as const;
export type StatementStatus =
  (typeof StatementStatusValues)[keyof typeof StatementStatusValues];

export interface BillingStatement {
  readonly id: StatementId;
  readonly userId: UserId;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly totalDue: MoneyCents;
  readonly status: StatementStatus;
  readonly dueDate: string;
  readonly createdAt: string;
  readonly paidAt?: string;
}

export interface CreditPolicy {
  readonly id: PolicyId;
  readonly version: number;
  readonly tierLimits: Readonly<Record<ScoreTier, MoneyCents>>;
  readonly effectiveFrom: string;
}

/** Entitlement 扩展状态（phase-6） */
export const EntitlementStatusPhase6Values = {
  ...{ Active: "ACTIVE", Expired: "EXPIRED", Revoked: "REVOKED" },
  Frozen: "FROZEN",
} as const;
export type EntitlementStatusPhase6 =
  EntitlementStatus | "FROZEN";

export interface PurchaseWithCreditCommand {
  readonly userId: UserId;
  readonly productId: ProductId;
}

export interface RepayCommand {
  readonly userId: UserId;
  readonly statementId: StatementId;
  readonly amount: MoneyCents;
}

export type CreditDomainErrorCode =
  | "CREDIT_LIMIT_EXCEEDED"
  | "CREDIT_OVERDUE_BLOCKED"
  | "STATEMENT_NOT_DUE"
  | "REPAY_AMOUNT_INSUFFICIENT"
  | "CREDIT_PROFILE_FROZEN";

export interface CreditPurchaseService {
  purchaseWithCredit(cmd: PurchaseWithCreditCommand): Promise<OrderId>;
}

export interface BillingService {
  generateMonthlyStatements(periodEnd: string): Promise<readonly BillingStatement[]>;
  markOverdue(asOf: string): Promise<void>;
}

export interface CreditRepaymentService {
  repay(cmd: RepayCommand): Promise<BillingStatement>;
}
