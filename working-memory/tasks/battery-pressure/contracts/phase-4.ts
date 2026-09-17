/**
 * 阶段 4 契约：分润 + 延迟结算
 *
 * 依赖 phase-3 OrgId · phase-0 OrderId/MoneyCents
 */

import type { MoneyCents, OrderId, UserId, Currency } from "./phase-0.js";
import type { OrgId } from "./phase-3.js";

export type RuleId = string & { readonly __brand: "RuleId" };
export type AccrualId = string & { readonly __brand: "AccrualId" };
export type BatchId = string & { readonly __brand: "BatchId" };
export type BindingId = string & { readonly __brand: "BindingId" };

export const ReferralStatusValues = {
  Active: "active",
  Expired: "expired",
} as const;
export type ReferralStatus =
  (typeof ReferralStatusValues)[keyof typeof ReferralStatusValues];

export interface ReferralBinding {
  readonly id: BindingId;
  readonly userId: UserId;
  readonly promoterOrgId: OrgId;
  readonly boundAt: string;
  readonly expiresAt: string;
  readonly status: ReferralStatus;
}

export interface ProfitSplit {
  readonly orgId: OrgId;
  readonly percentage: number;
}

export interface ProfitSharingRule {
  readonly id: RuleId;
  readonly orgId: OrgId;
  readonly eventType: "ORDER_COMPLETED";
  readonly splits: readonly ProfitSplit[];
  readonly promoterBonusPercent?: number;
  readonly version: number;
  readonly effectiveFrom: string;
  readonly effectiveUntil?: string;
}

export const AccrualStatusValues = {
  Pending: "PENDING",
  Settled: "SETTLED",
  Reversed: "REVERSED",
} as const;
export type AccrualStatus =
  (typeof AccrualStatusValues)[keyof typeof AccrualStatusValues];

export interface ProfitShareAccrual {
  readonly id: AccrualId;
  readonly orderId: OrderId;
  readonly orgId: OrgId;
  readonly amount: MoneyCents;
  readonly currency: Currency;
  readonly ruleVersion: number;
  readonly status: AccrualStatus;
  readonly batchId?: BatchId;
  readonly reversalOf?: AccrualId;
  readonly createdAt: string;
  readonly settledAt?: string;
}

export const BatchStatusValues = {
  Open: "OPEN",
  Closed: "CLOSED",
  Paid: "PAID",
} as const;
export type BatchStatus =
  (typeof BatchStatusValues)[keyof typeof BatchStatusValues];

export interface SettlementBatch {
  readonly id: BatchId;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly status: BatchStatus;
  readonly createdAt: string;
  readonly closedAt?: string;
}

export type ProfitSharingDomainErrorCode =
  | "REFERRAL_ALREADY_BOUND"
  | "REFERRAL_EXPIRED"
  | "ORDER_NOT_REFUNDABLE_SETTLED"
  | "SPLIT_PERCENTAGE_OVERFLOW"
  | "ACCRUAL_ALREADY_SETTLED";

export interface ProfitSharingEngine {
  onOrderCompleted(orderId: OrderId): Promise<readonly ProfitShareAccrual[]>;
  onOrderRefunded(orderId: OrderId): Promise<readonly ProfitShareAccrual[]>;
}

export interface SettlementBatchService {
  closeBatch(periodEnd: string): Promise<SettlementBatch>;
}

export interface ProfitSplitValidator {
  validate(splits: readonly ProfitSplit[]): boolean;
}
