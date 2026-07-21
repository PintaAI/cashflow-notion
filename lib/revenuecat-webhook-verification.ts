import { createHmac, timingSafeEqual } from "node:crypto";

const WEBHOOK_TOLERANCE_SECONDS = 300;

function getWebhookConfig() {
  const authorization = process.env.REVENUECAT_WEBHOOK_AUTHORIZATION;
  const signingSecret = process.env.REVENUECAT_WEBHOOK_SIGNING_SECRET;
  if (!authorization) {
    throw new WebhookVerificationError("RevenueCat webhook authorization is required");
  }
  return { authorization, signingSecret };
}

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookVerificationError";
  }
}

export function verifyRawWebhook(rawBody: string, headers: Headers): boolean {
  const { authorization, signingSecret } = getWebhookConfig();
  const authHeader = headers.get("Authorization") ?? "";
  const expectedAuthorization = authorization.startsWith("Bearer ")
    ? authorization
    : `Bearer ${authorization}`;
  const providedAuthorization = Buffer.from(authHeader);
  const expectedAuthorizationBuffer = Buffer.from(expectedAuthorization);
  if (
    providedAuthorization.length !== expectedAuthorizationBuffer.length ||
    !timingSafeEqual(providedAuthorization, expectedAuthorizationBuffer)
  ) {
    return false;
  }

  if (!signingSecret) return true;

  const signatureHeader = headers.get("X-RevenueCat-Webhook-Signature");
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((segment) => {
      const separator = segment.indexOf("=");
      return separator === -1
        ? [segment, ""]
        : [segment.slice(0, separator), segment.slice(separator + 1)];
    }),
  );
  const timestampValue = parts.t;
  const signature = parts.v1;
  if (!timestampValue || !signature) return false;

  const timestamp = Number.parseInt(timestampValue, 10);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > WEBHOOK_TOLERANCE_SECONDS) return false;

  const computed = createHmac("sha256", signingSecret)
    .update(`${timestampValue}.${rawBody}`, "utf8")
    .digest("hex");
  const providedSignature = Buffer.from(signature);
  const expectedSignature = Buffer.from(computed);
  return providedSignature.length === expectedSignature.length &&
    timingSafeEqual(providedSignature, expectedSignature);
}
