import type {
  AdapterContract,
  NotificationAdapter,
  Platform,
  PurchaseAdapter,
  StorageAdapter,
  TelemetryAdapter,
} from "../contracts/index.js";

/** Host-provided capabilities keep native APIs outside the portable core. */
export interface HostCapabilities {
  readonly storage: StorageAdapter;
  readonly telemetry?: TelemetryAdapter;
  readonly notifications?: NotificationAdapter;
  readonly purchases?: PurchaseAdapter;
}

const unsupportedTelemetry: TelemetryAdapter = {
  async track() {},
};
const unsupportedNotifications: NotificationAdapter = {
  async notify() {},
};
const unsupportedPurchases: PurchaseAdapter = {
  async purchase() {
    throw new Error("Unsupported purchase capability");
  },
};

/** Creates a safe baseline for hosts that do not provide privileged bridges. */
export function unsupportedCapabilities(storage: StorageAdapter): HostCapabilities {
  return { storage };
}

/** Build a platform adapter without probing globals or importing native SDKs. */
export function createAdapter(
  platform: Platform,
  capabilities: HostCapabilities,
): AdapterContract {
  return {
    platform,
    storage: capabilities.storage,
    telemetry: capabilities.telemetry ?? unsupportedTelemetry,
    notifications: capabilities.notifications ?? unsupportedNotifications,
    purchases: capabilities.purchases ?? unsupportedPurchases,
  };
}
