import { createAndroidAdapter } from "./android/index.js";
import { createDesktopAdapter } from "./desktop/index.js";
import { createIOSAdapter } from "./ios/index.js";
import { createWebAdapter } from "./web/index.js";

export { createAndroidAdapter, createDesktopAdapter, createIOSAdapter, createWebAdapter };
export type { HostCapabilities } from "./hosts.js";
