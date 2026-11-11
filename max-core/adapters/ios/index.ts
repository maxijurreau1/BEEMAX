import { createAdapter, type HostCapabilities } from "../hosts.js";
import type { AdapterContract } from "../../contracts/index.js";

/** The host supplies storage and privileged bridges for ios. */
export function createIOSAdapter(capabilities: HostCapabilities): AdapterContract {
  return createAdapter("ios", capabilities);
}
