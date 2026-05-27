import { NextResponse } from "next/server";
import { get, put } from "@vercel/blob";

export const dynamic = "force-dynamic";

export async function POST() {
  const token = process.env.NOTIF_READ_WRITE_TOKEN;
  const storeId = process.env.NOTIF_STORE_ID;

  const results: Record<string, unknown> = {};

  if (token) {
    // Try reading the actual subscription blob
    try {
      const blob = await get("notifications/push-subscriptions.json", {
        token,
        access: "public",
        useCache: false,
      });
      if (blob?.stream) {
        const reader = blob.stream.getReader();
        const decoder = new TextDecoder();
        let text = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
        }
        text += decoder.decode();
        results.getSubscriptions = JSON.parse(text);
        results.getStatusCode = blob.statusCode;
      } else {
        results.getSubscriptions = null;
      }
    } catch (e: unknown) {
      results.getSubscriptionsError = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json(results);
}
