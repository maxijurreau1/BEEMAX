export type AdapterKind = "provider" | "renderer" | "telemetry" | "simulation" | "transport" | "storage";
export type AdapterState =
  | "CONNECTED"
  | "DEGRADED"
  | "STALE"
  | "BLOCKED"
  | "DISCONNECTED"
  | "UNCONFIGURED";

/** Identity metadata is provenance, not a credential, signature, or ownership proof. */
export const SOVEREIGN_IDENTITY_ANCHOR = "bba28add4f99bd9aae158f173168145d";

export interface AdapterManifest {
  readonly id: string;
  readonly version: string;
  readonly type: AdapterKind;
  readonly identityAnchor: string;
}

export interface AdapterRegistration<T = unknown> {
  readonly kind: AdapterKind;
  readonly id: string;
  readonly identityAnchor: string;
  readonly state: AdapterState;
  readonly adapter: T;
}

interface RegistryEntry {
  readonly manifest: AdapterManifest;
  readonly state: AdapterState;
  readonly adapter: unknown;
  readonly handler?: (...args: any[]) => any;
}

/** Registry bindings are explicit and immutable; nothing is considered active by default. */
export class AdapterRegistry {
  private readonly registrations = new Map<string, RegistryEntry>();

  register<T>(registration: AdapterRegistration<T>): void;
  register(manifest: AdapterManifest, handler: (...args: any[]) => any): void;
  register<T>(
    registrationOrManifest: AdapterRegistration<T> | AdapterManifest,
    handler?: (...args: any[]) => any,
  ): void {
    const manifest: AdapterManifest = "kind" in registrationOrManifest
      ? {
          id: registrationOrManifest.id,
          version: "1.0.0",
          type: registrationOrManifest.kind,
          identityAnchor: registrationOrManifest.identityAnchor,
        }
      : registrationOrManifest;
    const state = "kind" in registrationOrManifest ? registrationOrManifest.state : "CONNECTED";
    const adapter = "kind" in registrationOrManifest ? registrationOrManifest.adapter : handler;
    const effectiveHandler: ((...args: any[]) => any) | undefined =
      handler ?? (typeof adapter === "function" ? (adapter as (...args: any[]) => any) : undefined);

    if (!manifest.id.trim()) throw new TypeError("adapter id is required");
    if (!manifest.version.trim()) throw new TypeError("adapter version is required");
    if (manifest.identityAnchor !== SOVEREIGN_IDENTITY_ANCHOR)
      throw new Error("Adapter rejected: invalid identity anchor");
    if (this.registrations.has(manifest.id))
      throw new Error(`Adapter collision detected for ID: ${manifest.id}`);
    this.registrations.set(manifest.id, Object.freeze({
      manifest: Object.freeze({ ...manifest }),
      state,
      adapter,
      ...(effectiveHandler ? { handler: effectiveHandler } : {}),
    }));
  }

  replace<T>(registration: AdapterRegistration<T>): void {
    const existing = this.registrations.get(registration.id);
    if (!existing) throw new Error(`Adapter not found: ${registration.id}`);
    if (registration.identityAnchor !== SOVEREIGN_IDENTITY_ANCHOR)
      throw new Error("Adapter rejected: invalid identity anchor");
    const nextHandler = typeof registration.adapter === "function"
      ? registration.adapter as (...args: any[]) => any
      : undefined;
    this.registrations.set(registration.id, Object.freeze({
      manifest: Object.freeze({ ...existing.manifest, type: registration.kind, identityAnchor: registration.identityAnchor }),
      state: registration.state,
      adapter: registration.adapter,
      ...(nextHandler ? { handler: nextHandler } : {}),
    }));
  }

  get<T = unknown>(kind: AdapterKind, id: string): AdapterRegistration<T> | undefined {
    const entry = this.registrations.get(id);
    if (!entry || entry.manifest.type !== kind) return undefined;
    return { kind, id, identityAnchor: entry.manifest.identityAnchor, state: entry.state, adapter: entry.adapter as T };
  }

  resolve<T extends (...args: any[]) => any = (...args: any[]) => any>(id: string): T {
    const entry = this.registrations.get(id);
    if (!entry) throw new Error(`Unregistered adapter requested: ${id}`);
    if (!entry.handler) throw new Error(`Adapter has no callable handler: ${id}`);
    return entry.handler as T;
  }

  list(kind?: AdapterKind): readonly AdapterRegistration[] {
    return [...this.registrations.values()]
      .filter((entry) => !kind || entry.manifest.type === kind)
      .map((entry) => ({
        kind: entry.manifest.type,
        id: entry.manifest.id,
        identityAnchor: entry.manifest.identityAnchor,
        state: entry.state,
        adapter: entry.adapter,
      }));
  }

  listManifests(): AdapterManifest[] {
    return [...this.registrations.values()].map(({ manifest }) => ({ ...manifest }));
  }
}

export const globalAdapterRegistry = new AdapterRegistry();
