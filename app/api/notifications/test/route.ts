import { NextResponse } from "next/server";
import { get, put, del, list } from "@vercel/blob";

export const dynamic = "force-dynamic";

export async function POST() {
  const storeId = process.env.NOTIF_STORE_ID;
  const token = process.env.NOTIF_READ_WRITE_TOKEN;
  const vercelOidc = process.env.VERCEL_OIDC_TOKEN;
  const hasOidcHeader = "x-vercel-oidc-token" in (Object.fromEntries(
    Object.entries(process.env).filter(([k]) => k.startsWith("VERCEL"))
  ));

  const results: Record<string, unknown> = {
    storeId,
    hasToken: !!token,
    hasVercelOidc: !!vercelOidc,
  };

  if (token) {
    try {
      results.putWithToken = await put("test-key.json", JSON.stringify({ test: true }), {
        token,
        access: "public",
        allowOverwrite: true,
      });
    } catch (e: unknown) {
      results.putWithTokenError = e instanceof Error ? e.message : String(e);
    }
  }

  if (storeId) {
    try {
      results.putWithStoreId = await put("test-key.json", JSON.stringify({ test: true }), {
        storeId,
        access: "public",
        allowOverwrite: true,
      });
    } catch (e: unknown) {
      results.putWithStoreIdError = e instanceof Error ? e.message : String(e);
    }
  }

  if (storeId && vercelOidc) {
    try {
      results.putWithOidc = await put("test-key.json", JSON.stringify({ test: true }), {
        storeId,
        oidcToken: vercelOidc,
        access: "public",
        allowOverwrite: true,
      });
    } catch (e: unknown) {
      results.putWithOidcError = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json(results);
}
