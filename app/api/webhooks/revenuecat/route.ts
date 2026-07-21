import { processWebhookEvent } from "@/lib/revenuecat-webhook";
import { verifyRawWebhook, WebhookVerificationError } from "@/lib/revenuecat-webhook-verification";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (!verifyRawWebhook(rawBody, request.headers)) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    const signatureHeader = request.headers.get("X-RevenueCat-Webhook-Signature");
    const timestampPart = signatureHeader?.split(",").find((part) => part.startsWith("t="));
    const timestamp = timestampPart ? Number.parseInt(timestampPart.slice(2), 10) : Number.NaN;
    const signatureTimestamp = Number.isFinite(timestamp) ? BigInt(timestamp) : null;
    return await processWebhookEvent(rawBody, signatureTimestamp);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "invalid json" }, { status: 400 });
    }
    if (error instanceof WebhookVerificationError) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ error: "internal server error" }, { status: 500 });
  }
}
