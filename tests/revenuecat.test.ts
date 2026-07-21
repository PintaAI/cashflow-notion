import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  normalizeRevenueCatEntitlements,
  type RevenueCatPurchase,
  type RevenueCatSubscription,
} from "../lib/revenuecat";
import { verifyRawWebhook } from "../lib/revenuecat-webhook-verification";

const premium = { items: [{ id: "entl_premium", lookup_key: "premium" }] };

function subscription(
  overrides: Partial<RevenueCatSubscription> = {},
): RevenueCatSubscription {
  return {
    id: "sub_annual",
    customer_id: "customer-1",
    original_customer_id: "customer-1",
    product_id: "prod_annual",
    ends_at: Date.UTC(2027, 6, 20),
    gives_access: true,
    status: "active",
    entitlements: premium,
    environment: "production",
    store: "app_store",
    ownership: "purchased",
    ...overrides,
  };
}

function purchase(overrides: Partial<RevenueCatPurchase> = {}): RevenueCatPurchase {
  return {
    id: "purchase_lifetime",
    customer_id: "customer-1",
    original_customer_id: "customer-1",
    product_id: "prod_lifetime",
    status: "owned",
    entitlements: premium,
    environment: "production",
    store: "app_store",
    ownership: "purchased",
    ...overrides,
  };
}

test("normalizes an active annual subscription without granting sandbox access", () => {
  const [production, sandbox] = normalizeRevenueCatEntitlements(
    "customer-1",
    "premium",
    [subscription()],
    [],
  );

  assert.equal(production.active, true);
  assert.equal(production.periodType, "subscription");
  assert.equal(production.productId, "prod_annual");
  assert.equal(production.expiresAt?.toISOString(), "2027-07-20T00:00:00.000Z");
  assert.equal(sandbox.active, false);
});

test("keeps sandbox and production entitlement state isolated", () => {
  const [production, sandbox] = normalizeRevenueCatEntitlements(
    "customer-1",
    "premium",
    [subscription({ environment: "sandbox" })],
    [],
  );

  assert.equal(production.active, false);
  assert.equal(sandbox.active, true);
});

test("ignores subscriptions that RevenueCat says do not give access", () => {
  const [production] = normalizeRevenueCatEntitlements(
    "customer-1",
    "premium",
    [subscription({ gives_access: false, status: "expired" })],
    [],
  );

  assert.equal(production.active, false);
  assert.equal(production.productId, null);
});

test("normalizes an owned one-time purchase as lifetime access", () => {
  const [production] = normalizeRevenueCatEntitlements(
    "customer-1",
    "premium",
    [],
    [purchase()],
  );

  assert.equal(production.active, true);
  assert.equal(production.periodType, "lifetime");
  assert.equal(production.expiresAt, null);
});

test("normalizes a promotional source separately", () => {
  const [production] = normalizeRevenueCatEntitlements(
    "customer-1",
    "premium",
    [subscription({ store: "promotional", ends_at: null })],
    [],
  );

  assert.equal(production.active, true);
  assert.equal(production.periodType, "promotional");
  assert.equal(production.expiresAt, null);
});

test("does not grant access from unrelated entitlements", () => {
  const [production] = normalizeRevenueCatEntitlements(
    "customer-1",
    "premium",
    [subscription({ entitlements: { items: [{ id: "entl_other", lookup_key: "other" }] } })],
    [],
  );

  assert.equal(production.active, false);
});

test("verifies RevenueCat authorization and raw-body HMAC", () => {
  const previousAuthorization = process.env.REVENUECAT_WEBHOOK_AUTHORIZATION;
  const previousSecret = process.env.REVENUECAT_WEBHOOK_SIGNING_SECRET;
  process.env.REVENUECAT_WEBHOOK_AUTHORIZATION = "Bearer webhook-token";
  process.env.REVENUECAT_WEBHOOK_SIGNING_SECRET = "signing-secret";

  try {
    const body = JSON.stringify({ api_version: "1.0", event: { id: "event-1" } });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac("sha256", "signing-secret")
      .update(`${timestamp}.${body}`)
      .digest("hex");
    const headers = new Headers({
      Authorization: "Bearer webhook-token",
      "X-RevenueCat-Webhook-Signature": `t=${timestamp},v1=${signature}`,
    });

    assert.equal(verifyRawWebhook(body, headers), true);
    assert.equal(verifyRawWebhook(`${body} `, headers), false);
    headers.set("Authorization", "Bearer wrong-token");
    assert.equal(verifyRawWebhook(body, headers), false);
  } finally {
    if (previousAuthorization === undefined) delete process.env.REVENUECAT_WEBHOOK_AUTHORIZATION;
    else process.env.REVENUECAT_WEBHOOK_AUTHORIZATION = previousAuthorization;
    if (previousSecret === undefined) delete process.env.REVENUECAT_WEBHOOK_SIGNING_SECRET;
    else process.env.REVENUECAT_WEBHOOK_SIGNING_SECRET = previousSecret;
  }
});

test("accepts Authorization-only webhooks when HMAC is unavailable", () => {
  const previousAuthorization = process.env.REVENUECAT_WEBHOOK_AUTHORIZATION;
  const previousSecret = process.env.REVENUECAT_WEBHOOK_SIGNING_SECRET;
  process.env.REVENUECAT_WEBHOOK_AUTHORIZATION = "Bearer webhook-token";
  delete process.env.REVENUECAT_WEBHOOK_SIGNING_SECRET;
  try {
    const headers = new Headers({ Authorization: "Bearer webhook-token" });
    assert.equal(verifyRawWebhook("{}", headers), true);
    headers.set("Authorization", "Bearer wrong-token");
    assert.equal(verifyRawWebhook("{}", headers), false);
  } finally {
    if (previousAuthorization === undefined) delete process.env.REVENUECAT_WEBHOOK_AUTHORIZATION;
    else process.env.REVENUECAT_WEBHOOK_AUTHORIZATION = previousAuthorization;
    if (previousSecret === undefined) delete process.env.REVENUECAT_WEBHOOK_SIGNING_SECRET;
    else process.env.REVENUECAT_WEBHOOK_SIGNING_SECRET = previousSecret;
  }
});
