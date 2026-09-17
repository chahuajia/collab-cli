/**
 * 阶段 7 契约：多厂商 IoT + 设备影子
 *
 * 依赖 phase-0 BatteryId · phase-3 OrgId
 */

import type { BatteryId } from "./phase-0.js";
import type { OrgId } from "./phase-3.js";
import type { UserId } from "./phase-0.js";

export type VendorId = string & { readonly __brand: "VendorId" };
export type CommandId = string & { readonly __brand: "CommandId" };
export type TicketId = string & { readonly __brand: "TicketId" };
export type TelemetryRecordId = string & { readonly __brand: "TelemetryRecordId" };

export interface ExternalDeviceRef {
  readonly externalDeviceId: string;
  readonly vendorId: VendorId;
}

export interface BatteryTelemetryReported {
  readonly batteryId: BatteryId;
  readonly vendorId: VendorId;
  readonly soc: number;
  readonly voltage: number;
  readonly reportedAt: string;
}

export type AlertType = "OVERHEAT" | "LOW_SOC" | "COMM_LOST";

export interface BatteryAlertRaised {
  readonly batteryId: BatteryId;
  readonly alertType: AlertType;
  readonly severity: "warning" | "critical";
  readonly raisedAt: string;
}

export type CommandAction = "LOCK" | "UNLOCK" | "RESET";

export interface BatteryCommand {
  readonly commandId: CommandId;
  readonly batteryId: BatteryId;
  readonly action: CommandAction;
  readonly issuedBy: UserId;
  readonly issuedAt: string;
}

export interface BatteryCommandAcked {
  readonly commandId: CommandId;
  readonly batteryId: BatteryId;
  readonly action: CommandAction;
  readonly success: boolean;
  readonly ackedAt: string;
}

export interface DeviceShadow {
  readonly batteryId: BatteryId;
  readonly vendorId: VendorId;
  readonly externalDeviceId: string;
  readonly soc: number;
  readonly voltage: number;
  readonly temperature?: number;
  readonly lockState: "locked" | "unlocked";
  readonly status: "idle" | "rented" | "maintenance";
  readonly lastSeenAt: string;
  readonly stale: boolean;
  readonly updatedAt: string;
}

export interface TelemetryRecord {
  readonly id: TelemetryRecordId;
  readonly batteryId: BatteryId;
  readonly soc: number;
  readonly voltage: number;
  readonly recordedAt: string;
}

export interface MaintenanceTicket {
  readonly id: TicketId;
  readonly batteryId: BatteryId;
  readonly alertType: AlertType;
  readonly status: "open" | "resolved";
  readonly createdAt: string;
}

export interface ParseError {
  readonly kind: "PARSE_ERROR";
  readonly message: string;
}

export interface BatteryProviderAdapter {
  readonly vendorId: VendorId;
  discover(): Promise<readonly ExternalDeviceRef[]>;
  parseTelemetry(raw: unknown): BatteryTelemetryReported | ParseError;
  sendCommand(cmd: BatteryCommand): Promise<BatteryCommandAcked>;
  subscribe(
    handler: (event: BatteryTelemetryReported) => void,
  ): () => void;
}

export interface AdapterRegistry {
  register(adapter: BatteryProviderAdapter): void;
  get(vendorId: VendorId): BatteryProviderAdapter | undefined;
}

export interface DeviceShadowRepository {
  get(batteryId: BatteryId): Promise<DeviceShadow | null>;
  updateFromTelemetry(event: BatteryTelemetryReported): Promise<DeviceShadow>;
  markStale(batteryId: BatteryId): Promise<DeviceShadow>;
}

export interface TelemetryStore {
  append(record: Omit<TelemetryRecord, "id">): Promise<TelemetryRecord>;
  query(batteryId: BatteryId, from: string, to: string): Promise<readonly TelemetryRecord[]>;
}

export type IoTDomainErrorCode =
  | "TELEMETRY_STALE"
  | "VENDOR_NOT_REGISTERED"
  | "COMMAND_DUPLICATE"
  | "COMMAND_UNAUTHORIZED";
