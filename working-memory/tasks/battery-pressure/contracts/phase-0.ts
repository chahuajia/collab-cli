/**
 * 阶段 0 领域契约（A10 第 3 层）
 *
 * 位置：working-memory — 非运行时代码，仅供 review 与后续实现对照。
 * 不变量：见 phase-0-spec.md INV-1..5
 */

// ── 值对象 ──

export type Currency = "CNY";

/** 金额用整数分存储，避免浮点 */
export type MoneyCents = number & { readonly __brand: "MoneyCents" };

export type OrgId = string & { readonly __brand: "OrgId" };
export type UserId = string & { readonly __brand: "UserId" };
export type ProductId = string & { readonly __brand: "ProductId" };
export type OrderId = string & { readonly __brand: "OrderId" };
export type EntitlementId = string & { readonly __brand: "EntitlementId" };
export type UsageEventId = string & { readonly __brand: "UsageEventId" };
export type BatteryId = string & { readonly __brand: "BatteryId" };
export type CabinetId = string & { readonly __brand: "CabinetId" };
export type AccountId = string & { readonly __brand: "AccountId" };
export type LedgerEntryId = string & { readonly __brand: "LedgerEntryId" };

export type ISODateTime = string;

// ── Product ──

export const ProductStatusValues = {
  Draft: "draft",
  Published: "published",
  Deprecated: "deprecated",
} as const;
export type ProductStatus =
  (typeof ProductStatusValues)[keyof typeof ProductStatusValues];

export const SwapLimitValues = {
  Unlimited: "UNLIMITED",
} as const;
export type SwapLimit =
  | (typeof SwapLimitValues)[keyof typeof SwapLimitValues]
  | { finite: number };

export interface FixedPriceRule {
  readonly kind: "FIXED_PRICE";
  readonly amount: MoneyCents;
  readonly currency: Currency;
}

export interface TimeWindowEntitlementRule {
  readonly kind: "TIME_WINDOW";
  readonly durationDays: number;
  readonly swapLimit: SwapLimit;
}

export interface Product {
  readonly id: ProductId;
  readonly orgId: OrgId;
  readonly name: string;
  readonly pricingRule: FixedPriceRule;
  readonly entitlementRule: TimeWindowEntitlementRule;
  readonly fulfillmentPolicy: "BATTERY_SWAP";
  readonly status: ProductStatus;
}

// ── Order ──

export const OrderStatusValues = {
  Created: "CREATED",
  Paid: "PAID",
  Refunded: "REFUNDED",
  Cancelled: "CANCELLED",
} as const;
export type OrderStatus =
  (typeof OrderStatusValues)[keyof typeof OrderStatusValues];

export interface Order {
  readonly id: OrderId;
  readonly userId: UserId;
  readonly productId: ProductId;
  readonly orgId: OrgId;
  readonly status: OrderStatus;
  readonly paidAmount: MoneyCents;
  readonly currency: Currency;
  readonly createdAt: ISODateTime;
  readonly paidAt?: ISODateTime;
  readonly refundedAt?: ISODateTime;
}

// ── Entitlement ──

export const EntitlementStatusValues = {
  Active: "ACTIVE",
  Expired: "EXPIRED",
  Revoked: "REVOKED",
} as const;
export type EntitlementStatus =
  (typeof EntitlementStatusValues)[keyof typeof EntitlementStatusValues];

export interface Entitlement {
  readonly id: EntitlementId;
  readonly orderId: OrderId;
  readonly userId: UserId;
  readonly productId: ProductId;
  readonly validFrom: ISODateTime;
  readonly validUntil: ISODateTime;
  readonly swapLimit: SwapLimit;
  readonly status: EntitlementStatus;
}

// ── UsageEvent ──

/** STARTED = 进行中（对应 INV-3 的 active usage） */
export const UsageEventStatusValues = {
  Started: "STARTED",
  Completed: "COMPLETED",
  Failed: "FAILED",
} as const;
export type UsageEventStatus =
  (typeof UsageEventStatusValues)[keyof typeof UsageEventStatusValues];

export interface UsageEvent {
  readonly id: UsageEventId;
  readonly userId: UserId;
  readonly entitlementId: EntitlementId;
  readonly batteryId: BatteryId;
  readonly cabinetId: CabinetId;
  readonly status: UsageEventStatus;
  readonly startedAt: ISODateTime;
  readonly completedAt?: ISODateTime;
}

// ── BatteryAsset ──

export const BatteryStatusValues = {
  Idle: "idle",
  Rented: "rented",
  Maintenance: "maintenance",
} as const;
export type BatteryStatus =
  (typeof BatteryStatusValues)[keyof typeof BatteryStatusValues];

export interface BatteryAsset {
  readonly id: BatteryId;
  readonly orgId: OrgId;
  readonly vendor: string;
  readonly model: string;
  readonly status: BatteryStatus;
  readonly currentHolderId?: UserId;
}

// ── Ledger ──

export const AccountOwnerTypeValues = {
  User: "USER",
  Org: "ORG",
  Platform: "PLATFORM",
} as const;
export type AccountOwnerType =
  (typeof AccountOwnerTypeValues)[keyof typeof AccountOwnerTypeValues];

export const AccountTypeValues = {
  Balance: "BALANCE",
  Settlement: "SETTLEMENT",
} as const;
export type AccountType =
  (typeof AccountTypeValues)[keyof typeof AccountTypeValues];

export interface Account {
  readonly id: AccountId;
  readonly ownerType: AccountOwnerType;
  readonly ownerId: string;
  readonly type: AccountType;
  readonly currency: Currency;
}

export const LedgerRefTypeValues = {
  OrderPayment: "ORDER_PAYMENT",
  OrderRefund: "ORDER_REFUND",
} as const;
export type LedgerRefType =
  (typeof LedgerRefTypeValues)[keyof typeof LedgerRefTypeValues];

/** 追加-only；INV-1 由仓储层写入前校验 */
export interface LedgerEntry {
  readonly id: LedgerEntryId;
  readonly debitAccountId: AccountId;
  readonly creditAccountId: AccountId;
  readonly amount: MoneyCents;
  readonly currency: Currency;
  readonly refType: LedgerRefType;
  readonly refId: OrderId;
  readonly createdAt: ISODateTime;
}

// ── 领域端口（无实现） ──

export interface PurchaseCommand {
  readonly userId: UserId;
  readonly productId: ProductId;
}

export interface SwapCommand {
  readonly userId: UserId;
  readonly entitlementId: EntitlementId;
  readonly cabinetId: CabinetId;
}

export interface RefundCommand {
  readonly orderId: OrderId;
  readonly requestedBy: UserId;
}

export type DomainErrorCode =
  | "INSUFFICIENT_BALANCE"
  | "PRODUCT_NOT_PUBLISHED"
  | "ENTITLEMENT_INACTIVE"
  | "ENTITLEMENT_EXPIRED"
  | "BATTERY_NOT_AVAILABLE"
  | "BATTERY_ALREADY_RENTED"
  | "REFUND_BLOCKED_IN_PROGRESS_SWAP"
  | "ORDER_NOT_REFUNDABLE";

export interface DomainError {
  readonly code: DomainErrorCode;
  readonly message: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: DomainError };

/** 购买：Order PAID + Entitlement ACTIVE + LedgerEntry */
export interface PurchaseService {
  purchase(cmd: PurchaseCommand): Promise<Result<Order>>;
}

/** 换电：UsageEvent COMPLETED + Battery 状态更新 */
export interface SwapService {
  swap(cmd: SwapCommand): Promise<Result<UsageEvent>>;
}

/** 退款：Order REFUNDED + Entitlement REVOKED + 反向分录 */
export interface RefundService {
  refund(cmd: RefundCommand): Promise<Result<Order>>;
}
