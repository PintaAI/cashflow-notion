const REVENUECAT_BASE_URL = "https://api.revenuecat.com/v2";
const REVENUECAT_V1_BASE_URL = "https://api.revenuecat.com/v1";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;

type RevenueCatEnvironment = "production" | "sandbox";

export type RevenueCatEntitlement = {
  id: string;
  lookup_key: string;
};

export type RevenueCatEntitlementList = {
  items: RevenueCatEntitlement[];
};

export type RevenueCatSubscription = {
  id: string;
  customer_id: string;
  original_customer_id: string;
  product_id: string | null;
  ends_at: number | null;
  gives_access: boolean;
  status: string;
  entitlements: RevenueCatEntitlementList;
  environment: RevenueCatEnvironment;
  store: string;
  ownership: string;
};

export type RevenueCatPurchase = {
  id: string;
  customer_id: string;
  original_customer_id: string;
  product_id: string | null;
  status: string;
  entitlements: RevenueCatEntitlementList;
  environment: RevenueCatEnvironment;
  store: string;
  ownership: string;
};

type RevenueCatList<T> = {
  object: "list";
  items: T[];
  next_page: string | null;
};

export type RevenueCatEntitlementProjection = {
  entitlementKey: string;
  active: boolean;
  environment: RevenueCatEnvironment;
  store: string | null;
  productId: string | null;
  periodType: "subscription" | "lifetime" | "promotional" | null;
  ownership: string | null;
  expiresAt: Date | null;
  revenueCatCustomerId: string | null;
  revenueCatOriginalUserId: string | null;
};

export class RevenueCatApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "RevenueCatApiError";
  }
}

function getConfig() {
  const projectId = process.env.REVENUECAT_PROJECT_ID;
  const secretKey = process.env.REVENUECAT_V2_SECRET_KEY;
  if (!projectId || !secretKey) {
    throw new RevenueCatApiError("REVENUECAT_NOT_CONFIGURED", 503);
  }
  return { projectId, secretKey };
}

async function revenueCatRequest<T>(path: string): Promise<T | null> {
  const { secretKey } = getConfig();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${REVENUECAT_BASE_URL}${path}`, {
        headers: { Authorization: `Bearer ${secretKey}`, Accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (error) {
      if (attempt < MAX_ATTEMPTS) continue;
      throw new RevenueCatApiError(
        error instanceof Error ? `RevenueCat request failed: ${error.message}` : "RevenueCat request failed",
        503,
      );
    }

    if (response.ok) return (await response.json()) as T;
    if (response.status === 404) return null;

    const retryAfter = Number.parseInt(response.headers.get("Retry-After") ?? "", 10);
    const retryAfterSeconds = Number.isFinite(retryAfter) ? retryAfter : null;
    const retryable = response.status === 429 || response.status >= 500;
    if (retryable && attempt < MAX_ATTEMPTS) {
      const delayMs = Math.min((retryAfterSeconds ?? attempt) * 1000, 3000);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }

    throw new RevenueCatApiError(
      `RevenueCat returned HTTP ${response.status}`,
      response.status === 429 ? 503 : response.status,
      retryAfterSeconds,
    );
  }

  throw new RevenueCatApiError("RevenueCat request failed", 503);
}

async function listAll<T>(initialPath: string): Promise<T[]> {
  const items: T[] = [];
  let path: string | null = initialPath;

  while (path) {
    const page: RevenueCatList<T> | null = await revenueCatRequest<RevenueCatList<T>>(path);
    if (!page) return items;
    items.push(...page.items);
    path = page.next_page?.replace(/^\/v2/, "") ?? null;
  }

  return items;
}

function hasEntitlement(item: { entitlements: RevenueCatEntitlementList }, entitlementKey: string) {
  return item.entitlements.items.some((entitlement) => entitlement.lookup_key === entitlementKey);
}

function chooseProjection(
  appUserId: string,
  entitlementKey: string,
  environment: RevenueCatEnvironment,
  subscriptions: RevenueCatSubscription[],
  purchases: RevenueCatPurchase[],
): RevenueCatEntitlementProjection {
  const activeSubscriptions = subscriptions.filter(
    (subscription) =>
      subscription.environment === environment &&
      subscription.gives_access &&
      hasEntitlement(subscription, entitlementKey),
  );
  const activePurchases = purchases.filter(
    (purchase) =>
      purchase.environment === environment &&
      purchase.status === "owned" &&
      hasEntitlement(purchase, entitlementKey),
  );

  const purchase = activePurchases[0];
  if (purchase) {
    return {
      entitlementKey,
      active: true,
      environment,
      store: purchase.store,
      productId: purchase.product_id,
      periodType: purchase.store === "promotional" ? "promotional" : "lifetime",
      ownership: purchase.ownership,
      expiresAt: null,
      revenueCatCustomerId: purchase.customer_id,
      revenueCatOriginalUserId: purchase.original_customer_id,
    };
  }

  const subscription = activeSubscriptions.sort((left, right) => (right.ends_at ?? 0) - (left.ends_at ?? 0))[0];
  if (subscription) {
    return {
      entitlementKey,
      active: true,
      environment,
      store: subscription.store,
      productId: subscription.product_id,
      periodType: subscription.store === "promotional" ? "promotional" : "subscription",
      ownership: subscription.ownership,
      expiresAt: subscription.ends_at === null ? null : new Date(subscription.ends_at),
      revenueCatCustomerId: subscription.customer_id,
      revenueCatOriginalUserId: subscription.original_customer_id,
    };
  }

  return {
    entitlementKey,
    active: false,
    environment,
    store: null,
    productId: null,
    periodType: null,
    ownership: null,
    expiresAt: null,
    revenueCatCustomerId: appUserId,
    revenueCatOriginalUserId: null,
  };
}

export function normalizeRevenueCatEntitlements(
  appUserId: string,
  entitlementKey: string,
  subscriptions: RevenueCatSubscription[],
  purchases: RevenueCatPurchase[],
): RevenueCatEntitlementProjection[] {
  return (["production", "sandbox"] as const).map((environment) =>
    chooseProjection(appUserId, entitlementKey, environment, subscriptions, purchases),
  );
}

export async function fetchRevenueCatEntitlements(
  appUserId: string,
  entitlementKey = "premium",
): Promise<RevenueCatEntitlementProjection[]> {
  const { projectId } = getConfig();
  const basePath = `/projects/${encodeURIComponent(projectId)}/customers/${encodeURIComponent(appUserId)}`;
  const environments = ["production", "sandbox"] as const;

  const results = await Promise.all(
    environments.flatMap((environment) => [
      listAll<RevenueCatSubscription>(`${basePath}/subscriptions?environment=${environment}&limit=100`),
      listAll<RevenueCatPurchase>(`${basePath}/purchases?environment=${environment}&limit=100`),
    ]),
  );
  const subscriptions = [...results[0], ...results[2]] as RevenueCatSubscription[];
  const purchases = [...results[1], ...results[3]] as RevenueCatPurchase[];

  return normalizeRevenueCatEntitlements(appUserId, entitlementKey, subscriptions, purchases);
}

function getV1AdminConfig() {
  const adminKey = process.env.REVENUECAT_V1_SECRET_KEY;
  if (!adminKey) {
    throw new RevenueCatApiError("REVENUECAT_NOT_CONFIGURED", 503);
  }
  return { adminKey };
}

function getV2AdminConfig() {
  const adminKey = process.env.REVENUECAT_V2_ADMIN_SECRET_KEY;
  if (!adminKey) {
    throw new RevenueCatApiError("REVENUECAT_NOT_CONFIGURED", 503);
  }
  return { adminKey };
}

export async function grantPromotionalEntitlement(
  appUserId: string,
  entitlementIdentifier: string,
  duration: string = "lifetime",
): Promise<{ success: true; reference: string }> {
  const { adminKey } = getV1AdminConfig();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(
        `${REVENUECAT_V1_BASE_URL}/subscribers/${encodeURIComponent(appUserId)}/entitlements/${encodeURIComponent(entitlementIdentifier)}/promotional`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${adminKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ duration }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
    } catch (error) {
      if (attempt < MAX_ATTEMPTS) continue;
      throw new RevenueCatApiError(
        error instanceof Error ? `Grant entitlement request failed: ${error.message}` : "Grant entitlement request failed",
        503,
      );
    }

    if (response.ok) {
      const body = await response.json();
      const reference = body?.subscriber?.entitlements?.[entitlementIdentifier]?.purchase_date
        ? `${entitlementIdentifier}-grant-${appUserId}-${body.subscriber.entitlements[entitlementIdentifier].purchase_date}`
        : `${entitlementIdentifier}-grant-${appUserId}`;
      return { success: true, reference };
    }

    const retryAfter = Number.parseInt(response.headers.get("Retry-After") ?? "", 10);
    const retryAfterSeconds = Number.isFinite(retryAfter) ? retryAfter : null;
    const retryable = response.status === 429 || response.status >= 500;
    if (retryable && attempt < MAX_ATTEMPTS) {
      const delayMs = Math.min((retryAfterSeconds ?? attempt) * 1000, 3000);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }

    throw new RevenueCatApiError(
      `Grant entitlement returned HTTP ${response.status}`,
      response.status === 429 ? 503 : response.status,
      retryAfterSeconds,
    );
  }

  throw new RevenueCatApiError("Grant entitlement request failed", 503);
}

export async function deleteRevenueCatCustomer(appUserId: string): Promise<void> {
  const { projectId } = getConfig();
  const { adminKey } = getV2AdminConfig();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(
        `${REVENUECAT_BASE_URL}/projects/${encodeURIComponent(projectId)}/customers/${encodeURIComponent(appUserId)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${adminKey}`, Accept: "application/json" },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
    } catch (error) {
      if (attempt < MAX_ATTEMPTS) continue;
      throw new RevenueCatApiError(
        error instanceof Error ? `Delete customer request failed: ${error.message}` : "Delete customer request failed",
        503,
      );
    }

    if (response.ok || response.status === 404) return;

    const retryAfter = Number.parseInt(response.headers.get("Retry-After") ?? "", 10);
    const retryAfterSeconds = Number.isFinite(retryAfter) ? retryAfter : null;
    const retryable = response.status === 429 || response.status >= 500;
    if (retryable && attempt < MAX_ATTEMPTS) {
      const delayMs = Math.min((retryAfterSeconds ?? attempt) * 1000, 3000);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }

    throw new RevenueCatApiError(
      `Delete customer returned HTTP ${response.status}`,
      response.status === 429 ? 503 : response.status,
      retryAfterSeconds,
    );
  }

  throw new RevenueCatApiError("Delete customer request failed", 503);
}
