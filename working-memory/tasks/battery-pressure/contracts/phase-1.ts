/**
 * 阶段 1 契约增量（extends phase-0.ts）
 *
 * 阶段 0 类型不修改 —— 本文件用联合类型扩展 Product / Entitlement / UsageEvent / Ledger。
 * 不变量：phase-1-spec.md INV-6..8
 */

import type {
  CabinetId,
  Currency,
  Entitlement,
  EntitlementId,
  MoneyCents,
  OrderId,
  Product,
  SwapLimit,
  UsageEvent,
  UsageEventId,
  UserId,
  LedgerEntry,
} from "./phase-0.js";

// ── PricingRule 扩展 ──

export interface MeteredPriceRule {
  readonly kind: "METERED";
  readonly unit: "SOC" | "DURATION";
  readonly rate: MoneyCents;
  readonly currency: Currency;
}

export type PricingRule =
  | { readonly kind: "FIXED_PRICE"; readonly amount: MoneyCents; readonly currency: Currency }
  | MeteredPriceRule;

// ── EntitlementRule 扩展 ──

export interface PayAsYouGoEntitlementRule {
  readonly kind: "PAY_AS_YOU_GO";
  readonly maxConcurrent: number;
}

export type EntitlementRule =
  | {
      readonly kind: "TIME_WINDOW";
      readonly durationDays: number;
      readonly swapLimit: SwapLimit;
    }
  | PayAsYouGoEntitlementRule;

export interface ProductPhase1 extends Omit<Product, "pricingRule" | "entitlementRule"> {
  readonly pricingRule: PricingRule;
  readonly entitlementRule: EntitlementRule;
}

// ── Entitlement 扩展 ──

export type MeteringMode = "PAY_AS_YOU_GO";

export interface EntitlementPhase1 extends Entitlement {
  readonly remainingSwaps?: number;
  readonly meteringMode?: MeteringMode;
  readonly validUntil?: string;
}

// ── UsageEvent 扩展 ──

export interface MeterReading {
  readonly socBefore: number;
  readonly socAfter: number;
}

export interface UsageEventPhase1 extends UsageEvent {
  readonly meterReading?: MeterReading;
  readonly chargedAmount?: MoneyCents;
}

// ── Ledger 扩展 ──

export const LedgerRefTypePhase1Values = {
  MeteredCharge: "METERED_CHARGE",
} as const;

export type LedgerRefTypePhase1 = "ORDER_PAYMENT" | "ORDER_REFUND" | "METERED_CHARGE";

export interface LedgerEntryPhase1 extends Omit<LedgerEntry, "refType" | "refId"> {
  readonly refType: LedgerRefTypePhase1;
  readonly refId: OrderId | UsageEventId;
}

// ── 错误码扩展 ──

export type DomainErrorCodePhase1 =
  | "INSUFFICIENT_BALANCE"
  | "PRODUCT_NOT_PUBLISHED"
  | "ENTITLEMENT_INACTIVE"
  | "ENTITLEMENT_EXPIRED"
  | "ENTITLEMENT_EXHAUSTED"
  | "BATTERY_NOT_AVAILABLE"
  | "BATTERY_ALREADY_RENTED"
  | "REFUND_BLOCKED_IN_PROGRESS_SWAP"
  | "ORDER_NOT_REFUNDABLE";

// ── Swap 命令扩展 ──

export interface SwapCommandPhase1 {
  readonly userId: UserId;
  readonly cabinetId: CabinetId;
  readonly entitlementId?: EntitlementId;
}

export interface EntitlementSelector {
  select(
    entitlements: readonly EntitlementPhase1[],
    explicitId?: EntitlementId,
  ): EntitlementPhase1 | null;
}
