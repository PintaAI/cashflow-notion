import { NextResponse } from "next/server";
import {
  exchangeAuthorizationCode,
  exchangeRefreshToken,
  getClient,
} from "@/lib/oauth/server";
import type { TokenRequest } from "@/lib/oauth/types";

export async function POST(req: Request) {
  try {
    let body: Record<string, string>;

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
    } else {
      body = await req.json();
    }

    const clientId =
      body.client_id ||
      extractBasicAuthClientId(req.headers.get("authorization"));
    const clientSecret = body.client_secret;
    const grantType = body.grant_type;

    if (!clientId) {
      return tokenError(400, "invalid_client", "Client ID is required");
    }

    const client = await getClient(clientId);
    if (!client) {
      return tokenError(400, "invalid_client", "Unknown client");
    }

    if (!client.isPublic) {
      if (!clientSecret || clientSecret !== client.clientSecret) {
        return tokenError(401, "invalid_client", "Invalid client credentials");
      }
    }

    if (!grantType) {
      return tokenError(400, "unsupported_grant_type", "Grant type is required");
    }

    switch (grantType) {
      case "authorization_code": {
        if (!body.code) {
          return tokenError(400, "invalid_request", "Authorization code is required");
        }

        const resource = body.resource || undefined;

        const result = await exchangeAuthorizationCode(
          clientId,
          body.code,
          body.code_verifier,
          body.redirect_uri || undefined,
          resource,
        );

        return NextResponse.json(result, {
          headers: {
            "Cache-Control": "no-store",
          },
        });
      }

      case "refresh_token": {
        if (!body.refresh_token) {
          return tokenError(400, "invalid_request", "Refresh token is required");
        }

        const requestedScopes = body.scope
          ? body.scope.split(/\s+/).filter(Boolean)
          : undefined;

        const resource = body.resource || undefined;

        const result = await exchangeRefreshToken(
          clientId,
          body.refresh_token,
          requestedScopes,
          resource,
        );

        return NextResponse.json(result, {
          headers: {
            "Cache-Control": "no-store",
          },
        });
      }

      default:
        return tokenError(400, "unsupported_grant_type", `Grant type '${grantType}' is not supported`);
    }
  } catch (error) {
    console.error("Token endpoint error:", error);
    return tokenError(
      400,
      "invalid_grant",
      error instanceof Error ? error.message : "Token exchange failed",
    );
  }
}

function extractBasicAuthClientId(authHeader: string | null): string | undefined {
  if (!authHeader || !authHeader.startsWith("Basic ")) return undefined;
  try {
    const base64 = authHeader.slice(6);
    const decoded = atob(base64);
    const colonIndex = decoded.indexOf(":");
    return colonIndex >= 0 ? decoded.slice(0, colonIndex) : decoded;
  } catch {
    return undefined;
  }
}

function tokenError(status: number, error: string, description: string) {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
