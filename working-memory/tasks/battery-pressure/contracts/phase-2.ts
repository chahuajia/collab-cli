/**
 * 阶段 2 契约增量：余额 + 积分混合支付
 *
 * extends phase-0.ts · 不变量 phase-2-spec.md INV-9..11
 */

import type {
  MoneyCents,
  OrderId,
  ProductId,
  UserId,
  AccountType,
  LedgerEntry,
  PurchaseCommand as PurchaseCommandPhase0,
} from "./phase-0.js";

// ── Account 扩展 ──

export const AccountTypePhase2Values = {
  Balance: "BALANCE",
  Points: "POINTS",
  Settlement: "SETTLEMENT",
} as const;
export type AccountTypePhase2 =
  (typeof AccountTypePhase2Values)[keyof typeof AccountTypePhase2Values];

export interface UserWalletPhase2 {
  readonly userId: UserId;
  readonly balanceAvailable: MoneyCents;
  readonly pointsAvailable: MoneyCents;
  readonly pointsExpiresAt?: string;
}

// ── Ledger refType 扩展 ──

export type LedgerRefTypePhase2 =
  | "ORDER_PAYMENT"
  | "ORDER_REFUND"
  | "ORDER_PAYMENT_POINTS"
  | "ORDER_PAYMENT_BALANCE"
  | "ORDER_REFUND_POINTS"
  | "ORDER_REFUND_BALANCE"
  | "METERED_CHARGE";

export interface LedgerEntryPhase2 extends Omit<LedgerEntry, "refType"> {
  readonly refType: LedgerRefTypePhase2;
}

// ── 支付意图 ──

export interface PaymentIntent {
  readonly usePoints: MoneyCents;
  readonly useBalance: MoneyCents;
}

export interface PurchaseCommandPhase2 extends Omit<PurchaseCommandPhase0, "productId"> {
  readonly productId: ProductId;
  readonly paymentIntent: PaymentIntent;
}

// ── 错误码扩展 ──

export type DomainErrorCodePhase2 =
  | "INSUFFICIENT_BALANCE"
  | "INSUFFICIENT_POINTS"
  | "POINTS_EXPIRED"
  | "PRODUCT_NOT_PUBLISHED"
  | "ENTITLEMENT_INACTIVE"
  | "ENTITLEMENT_EXPIRED"
  | "ENTITLEMENT_EXHAUSTED"
  | "BATTERY_NOT_AVAILABLE"
  | "BATTERY_ALREADY_RENTED"
  | "REFUND_BLOCKED_IN_PROGRESS_SWAP"
  | "ORDER_NOT_REFUNDABLE"
  | "PAYMENT_INTENT_MISMATCH";

/** 校验 usePoints + useBalance === price */
export interface PaymentIntentValidator {
  validate(intent: PaymentIntent, price: MoneyCents): boolean;
}

/** 先积分后余额写入分录 */
export interface MixedPaymentService {
  collectPayment(
    orderId: OrderId,
    wallet: UserWalletPhase2,
    intent: PaymentIntent,
  ): Promise<readonly LedgerEntryPhase2[]>;
  refundPayment(
    orderId: OrderId,
    originalEntries: readonly LedgerEntryPhase2[],
  ): Promise<readonly LedgerEntryPhase2[]>;
}
