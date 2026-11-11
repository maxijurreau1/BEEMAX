const DEFAULT_API_BASE = "https://market-place.maxgamesfactoryv3-1.workers.dev";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body) headers.set("Content-Type", "application/json");

  const configuredBase = (import.meta.env.VITE_API_BASE ?? "").trim();
  const apiBase = (configuredBase || DEFAULT_API_BASE).replace(/\/+$/, "");
  const url = path.startsWith("http") ? path : `${apiBase}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      // Cross-host cookies are needed by account flows. Browsers may restrict
      // these cookies; production sign-in should use the documented same-origin route.
      credentials: "include",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(
      `Could not reach the Marketplace API at ${apiBase}. Check the deployed Worker URL and Pages VITE_API_BASE setting.`,
      0,
    );
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data: unknown = await response.json();
      if (
        data &&
        typeof data === "object" &&
        "error" in data &&
        typeof data.error === "string"
      )
        message = data.error;
    } catch {
      /* Preserve status when a proxy returns a non-JSON error. */
    }
    if (response.status === 403) {
      message =
        "Marketplace request was blocked. Confirm the Pages hostname matches MARKETPLACE_ORIGIN in the Marketplace Worker configuration.";
    }
    throw new ApiError(message, response.status);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError("Marketplace API returned an invalid JSON response.", response.status);
  }
}

export function post<T>(path: string, body: unknown = {}) {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export interface Item {
  id: string;
  slug: string;
  title: string;
  summary: string;
  type: string;
  priceMinor: number;
  currency: string;
  creatorName: string;
  creatorSlug: string;
}

export function price(item: Item) {
  if (!item.priceMinor) return "Free";
  // Amounts use ISO 4217 minor units, including currencies with zero/three decimals.
  const formatter = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: item.currency,
  });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(item.priceMinor / 10 ** digits);
}
