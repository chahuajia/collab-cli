/**
 * 阶段 3 契约：多级运营商 + 套餐继承
 *
 * extends phase-1 Product 模型 · 不变量 phase-3-spec INV-12..13
 */

import type { MoneyCents, OrderId, UserId } from "./phase-0.js";
import type { ProductPhase1 } from "./phase-1.js";

export type OrgId = string & { readonly __brand: "OrgId" };
export type TemplateId = string & { readonly __brand: "TemplateId" };
export type OverrideId = string & { readonly __brand: "OverrideId" };
export type AuditLogId = string & { readonly __brand: "AuditLogId" };

export const OrgStatusValues = {
  Pending: "pending",
  Active: "active",
  Suspended: "suspended",
} as const;
export type OrgStatus = (typeof OrgStatusValues)[keyof typeof OrgStatusValues];

export const OperatorCapabilityValues = {
  Operator: "OPERATOR",
} as const;

export interface Organization {
  readonly id: OrgId;
  readonly name: string;
  readonly parentId?: OrgId;
  readonly capabilities: readonly ("OPERATOR")[];
  readonly regionScope: readonly string[];
  readonly status: OrgStatus;
}

export const RoleValues = {
  Admin: "ADMIN",
  OperatorStaff: "OPERATOR_STAFF",
} as const;
export type OperatorRole = (typeof RoleValues)[keyof typeof RoleValues];

export interface RoleBinding {
  readonly userId: UserId;
  readonly orgId: OrgId;
  readonly role: OperatorRole;
}

export const TemplateStatusValues = {
  Draft: "draft",
  Published: "published",
  Deprecated: "deprecated",
} as const;
export type TemplateStatus =
  (typeof TemplateStatusValues)[keyof typeof TemplateStatusValues];

export type OverridableField = "price" | "displayName";

export interface PackageTemplate {
  readonly id: TemplateId;
  readonly ownerOrgId: OrgId;
  readonly version: number;
  readonly baseProduct: ProductPhase1;
  readonly status: TemplateStatus;
  readonly inheritedFrom?: TemplateId;
  readonly allowedOverrideFields: readonly OverridableField[];
  readonly publishedAt?: string;
}

export const OverrideStatusValues = {
  Draft: "draft",
  Active: "active",
  Revoked: "revoked",
} as const;
export type OverrideStatus =
  (typeof OverrideStatusValues)[keyof typeof OverrideStatusValues];

export interface PackageOverridePatches {
  readonly price?: MoneyCents;
  readonly displayName?: string;
}

export interface PackageOverride {
  readonly id: OverrideId;
  readonly orgId: OrgId;
  readonly templateId: TemplateId;
  readonly templateVersion: number;
  readonly allowedFields: readonly OverridableField[];
  readonly patches: PackageOverridePatches;
  readonly effectiveFrom: string;
  readonly effectiveUntil?: string;
  readonly status: OverrideStatus;
}

export interface OrderProductSnapshot {
  readonly templateId: TemplateId;
  readonly templateVersion: number;
  readonly overrideId?: OverrideId;
  readonly product: ProductPhase1;
  readonly capturedAt: string;
}

export interface OrderPhase3Extension {
  readonly productSnapshot: OrderProductSnapshot;
}

export type AuditAction =
  | "template.publish"
  | "template.deprecate"
  | "override.activate"
  | "override.revoke";

export interface AuditLog {
  readonly id: AuditLogId;
  readonly actorUserId: UserId;
  readonly orgId: OrgId;
  readonly action: AuditAction;
  readonly resourceType: "PackageTemplate" | "PackageOverride";
  readonly resourceId: string;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly createdAt: string;
}

export type OrgDomainErrorCode =
  | "ORG_NOT_OWNER"
  | "ORG_NOT_DESCENDANT"
  | "FIELD_NOT_OVERRIDABLE"
  | "TEMPLATE_NOT_PUBLISHED"
  | "TEMPLATE_IMMUTABLE"
  | "OVERRIDE_INVALID";

export interface OrgPermissionService {
  isAncestor(ancestor: OrgId, descendant: OrgId): boolean;
  canManageTemplate(actorOrgId: OrgId, template: PackageTemplate): boolean;
  canCreateOverride(actorOrgId: OrgId, template: PackageTemplate): boolean;
}

export interface EffectiveProductResolver {
  resolve(
    template: PackageTemplate,
    override?: PackageOverride,
  ): ProductPhase1;
}
