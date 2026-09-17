/**
 * 阶段 5 契约：商城 + 优惠券
 *
 * 依赖 phase-3 OrgId · phase-2 PaymentIntent · phase-0 MoneyCents
 */

import type { MoneyCents, UserId, Currency } from "./phase-0.js";
import type { PaymentIntent } from "./phase-2.js";
import type { OrgId } from "./phase-3.js";

export type SkuId = string & { readonly __brand: "SkuId" };
export type MallOrderId = string & { readonly __brand: "MallOrderId" };
export type CouponTemplateId = string & { readonly __brand: "CouponTemplateId" };
export type UserCouponId = string & { readonly __brand: "UserCouponId" };
export type RedemptionId = string & { readonly __brand: "RedemptionId" };
export type CampaignId = string & { readonly __brand: "CampaignId" };
export type OnboardingId = string & { readonly __brand: "OnboardingId" };

export const MerchantCapabilityValues = {
  Merchant: "MERCHANT",
  Operator: "OPERATOR",
} as const;

export interface OnboardingApplication {
  readonly id: OnboardingId;
  readonly orgId: OrgId;
  readonly capability: "MERCHANT" | "OPERATOR";
  readonly status: "submitted" | "approved" | "rejected";
  readonly submittedAt: string;
  readonly reviewedAt?: string;
}

export interface MerchantProfile {
  readonly orgId: OrgId;
  readonly shopName: string;
  readonly status: "active" | "suspended";
}

export interface MallSku {
  readonly id: SkuId;
  readonly merchantOrgId: OrgId;
  readonly name: string;
  readonly price: MoneyCents;
  readonly currency: Currency;
  readonly stock: number;
  readonly status: "on_sale" | "off_sale";
}

export interface MallOrderLine {
  readonly skuId: SkuId;
  readonly qty: number;
  readonly unitPrice: MoneyCents;
}

export const MallOrderStatusValues = {
  Created: "CREATED",
  Paid: "PAID",
  Shipped: "SHIPPED",
  Completed: "COMPLETED",
  Refunded: "REFUNDED",
} as const;
export type MallOrderStatus =
  (typeof MallOrderStatusValues)[keyof typeof MallOrderStatusValues];

export interface MallOrder {
  readonly id: MallOrderId;
  readonly userId: UserId;
  readonly merchantOrgId: OrgId;
  readonly lines: readonly MallOrderLine[];
  readonly status: MallOrderStatus;
  readonly paymentIntent?: PaymentIntent;
  readonly discountTotal?: MoneyCents;
  readonly paidAmount: MoneyCents;
  readonly currency: Currency;
}

export type CouponKind = "FIXED_OFF" | "PERCENT_OFF";
export type CouponScope = "ALL_SKU" | "SKU_LIST" | "CATEGORY";
export type IssuerType = "OPERATOR" | "MERCHANT";

export interface CouponTemplate {
  readonly id: CouponTemplateId;
  readonly issuerOrgId: OrgId;
  readonly issuerType: IssuerType;
  readonly kind: CouponKind;
  readonly value: number;
  readonly minSpend?: MoneyCents;
  readonly scope: CouponScope;
  readonly scopeIds?: readonly string[];
  readonly mutexGroup: string;
  readonly campaignId: CampaignId;
  readonly validFrom: string;
  readonly validUntil: string;
  readonly perUserLimit?: number;
}

export interface Campaign {
  readonly id: CampaignId;
  readonly ownerOrgId: OrgId;
  readonly name: string;
  readonly budgetTotal: MoneyCents;
  readonly budgetRemaining: MoneyCents;
  readonly status: "draft" | "active" | "ended";
  readonly couponTemplateIds: readonly CouponTemplateId[];
}

export interface UserCoupon {
  readonly id: UserCouponId;
  readonly userId: UserId;
  readonly templateId: CouponTemplateId;
  readonly status: "available" | "locked" | "used" | "expired";
  readonly lockedByOrderId?: MallOrderId;
}

export interface CouponRedemption {
  readonly id: RedemptionId;
  readonly userCouponId: UserCouponId;
  readonly orderId: MallOrderId;
  readonly discountAmount: MoneyCents;
  readonly redeemedAt: string;
}

export type MallDomainErrorCode =
  | "COUPON_MUTEX_VIOLATION"
  | "COUPON_STACK_LIMIT"
  | "COUPON_SCOPE_MISMATCH"
  | "CAMPAIGN_BUDGET_EXhaustED"
  | "COUPON_MIN_SPEND_NOT_MET"
  | "MERCHANT_CANNOT_MANAGE_TEMPLATE";

export interface CouponRuleEngine {
  validateStack(coupons: readonly UserCoupon[], templates: readonly CouponTemplate[]): boolean;
  computeDiscount(
    orderTotal: MoneyCents,
    coupons: readonly UserCoupon[],
    templates: readonly CouponTemplate[],
  ): MoneyCents;
}

export interface MallCheckoutService {
  checkout(
    userId: UserId,
    lines: readonly MallOrderLine[],
    couponIds: readonly UserCouponId[],
  ): Promise<MallOrder>;
}
