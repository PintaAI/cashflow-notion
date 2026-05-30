import "server-only";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import {
  AUTH_CODE_EXPIRY_SECONDS,
  TOKEN_EXPIRY_SECONDS,
  REFRESH_TOKEN_EXPIRY_SECONDS,
  SCOPES_SUPPORTED,
  parseScopeString,
  createAuthInfo,
  isOAuthAccessToken,
  type AuthorizationRequest,
  type TokenResponse,
  type OAuthClientInfo,
} from "./types";

export { isOAuthAccessToken } from "./types";

function generateAccessToken(): string {
  return "oat_" + crypto.randomBytes(32).toString("hex");
}

function generateRefreshToken(): string {
  return "ort_" + crypto.randomBytes(32).toString("hex");
}

function generateAuthorizationCode(): string {
  return "oac_" + crypto.randomBytes(24).toString("hex");
}

function currentDate(): Date {
  return new Date();
}

function dateAdd(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

function sha256(input: string): Buffer {
  return crypto.createHash("sha256").update(input).digest();
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export function verifyPkceChallenge(
  codeVerifier: string,
  codeChallenge: string,
  codeChallengeMethod: string | null | undefined,
): boolean {
  const expectedChallenge =
    codeChallengeMethod === "S256"
      ? base64UrlEncode(sha256(codeVerifier))
      : codeVerifier;

  return expectedChallenge === codeChallenge;
}

export async function getClient(
  clientId: string,
): Promise<OAuthClientInfo | null> {
  const client = await prisma.oAuthClient.findUnique({
    where: { clientId },
  });
  if (!client) return null;

  return {
    clientId: client.clientId,
    clientSecret: client.clientSecret ?? undefined,
    clientName: client.clientName,
    clientUri: client.clientUri ?? undefined,
    logoUri: client.logoUri ?? undefined,
    redirectUris: client.redirectUris,
    grantTypes: client.grantTypes,
    responseTypes: client.responseTypes,
    scope: client.scope ?? undefined,
    isPublic: client.isPublic,
  };
}

export async function getOrCreateDefaultClient(): Promise<OAuthClientInfo> {
  let client = await prisma.oAuthClient.findUnique({
    where: { clientId: "cashflow-app" },
  });

  if (!client) {
    client = await prisma.oAuthClient.create({
      data: {
        clientId: "cashflow-app",
        clientName: "Cashflow Tracker",
        clientUri: process.env.BETTER_AUTH_URL || "http://localhost:3000",
        redirectUris: [
          "http://localhost:3000/oauth/callback",
          "http://127.0.0.1:3000/oauth/callback",
        ],
        grantTypes: ["authorization_code", "refresh_token"],
        responseTypes: ["code"],
        scope: SCOPES_SUPPORTED.join(" "),
        isPublic: true,
      },
    });
  }

  return {
    clientId: client.clientId,
    clientSecret: client.clientSecret ?? undefined,
    clientName: client.clientName,
    clientUri: client.clientUri ?? undefined,
    logoUri: client.logoUri ?? undefined,
    redirectUris: client.redirectUris,
    grantTypes: client.grantTypes,
    responseTypes: client.responseTypes,
    scope: client.scope ?? undefined,
    isPublic: client.isPublic,
  };
}

export function validateAuthorizationRequest(
  client: OAuthClientInfo,
  params: AuthorizationRequest,
): string | null {
  if (!client.responseTypes.includes(params.responseType)) {
    return "Unsupported response type";
  }

  if (!client.redirectUris.includes(params.redirectUri)) {
    return "Mismatched redirect URI";
  }

  if (params.codeChallengeMethod && params.codeChallengeMethod !== "S256") {
    return "Unsupported code challenge method. Only S256 is supported.";
  }

  return null;
}

export function getRequestedScopes(
  scopeParam: string | undefined,
  client: OAuthClientInfo,
): string[] {
  const requested = parseScopeString(scopeParam);
  if (requested.length === 0) {
    return parseScopeString(client.scope);
  }
  const clientScopes = parseScopeString(client.scope);
  return requested.filter((s) => clientScopes.includes(s));
}

export type AuthorizationResult =
  | { approved: true; redirectUri: string }
  | { approved: false; error: string; errorDescription?: string };

export async function createAuthorizationCode(
  clientId: string,
  userId: string,
  params: AuthorizationRequest,
): Promise<string> {
  const code = generateAuthorizationCode();
  const client = await getClient(clientId);
  const scopes = getRequestedScopes(
    params.scope,
    client ?? {
      clientId,
      clientName: "Unknown",
      redirectUris: [],
      grantTypes: [],
      responseTypes: [],
      isPublic: true,
    },
  );

  await prisma.oAuthAuthorizationCode.create({
    data: {
      code,
      clientId,
      userId,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge ?? null,
      codeChallengeMethod: params.codeChallengeMethod ?? null,
      scopes,
      resource: params.resource ?? null,
      expiresAt: dateAdd(currentDate(), AUTH_CODE_EXPIRY_SECONDS),
    },
  });

  return code;
}

export async function exchangeAuthorizationCode(
  clientId: string,
  code: string,
  codeVerifier?: string,
  redirectUri?: string,
  resource?: string,
): Promise<TokenResponse> {
  const authCode = await prisma.oAuthAuthorizationCode.findUnique({
    where: { code },
  });

  if (!authCode) {
    throw new Error("Invalid authorization code");
  }

  if (authCode.clientId !== clientId) {
    throw new Error("Authorization code was issued to a different client");
  }

  if (authCode.used) {
    throw new Error("Authorization code has already been used");
  }

  if (authCode.expiresAt < currentDate()) {
    throw new Error("Authorization code has expired");
  }

  if (redirectUri && authCode.redirectUri !== redirectUri) {
    throw new Error("Mismatched redirect URI");
  }

  if (authCode.codeChallenge) {
    if (!codeVerifier) {
      throw new Error("PKCE code verifier is required");
    }
    if (
      !verifyPkceChallenge(
        codeVerifier,
        authCode.codeChallenge,
        authCode.codeChallengeMethod,
      )
    ) {
      throw new Error("PKCE verification failed");
    }
  }

  await prisma.oAuthAuthorizationCode.update({
    where: { id: authCode.id },
    data: { used: true },
  });

  const accessToken = generateAccessToken();
  const refreshToken = generateRefreshToken();

  await prisma.oAuthToken.create({
    data: {
      accessToken,
      refreshToken,
      clientId,
      userId: authCode.userId,
      scopes: authCode.scopes,
      resource: authCode.resource ?? resource ?? null,
      expiresAt: dateAdd(currentDate(), TOKEN_EXPIRY_SECONDS),
    },
  });

  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: TOKEN_EXPIRY_SECONDS,
    refresh_token: refreshToken,
    scope: authCode.scopes.join(" "),
  };
}

export async function exchangeRefreshToken(
  clientId: string,
  refreshToken: string,
  scopes?: string[],
  resource?: string,
): Promise<TokenResponse> {
  const existing = await prisma.oAuthToken.findUnique({
    where: { refreshToken },
  });

  if (!existing) {
    throw new Error("Invalid refresh token");
  }

  if (existing.clientId !== clientId) {
    throw new Error("Refresh token was issued to a different client");
  }

  if (existing.revokedAt) {
    throw new Error("Refresh token has been revoked");
  }

  if (existing.expiresAt < currentDate()) {
    throw new Error("Refresh token has expired");
  }

  const newAccessToken = generateAccessToken();
  const newRefreshToken = generateRefreshToken();

  await prisma.oAuthToken.update({
    where: { id: existing.id },
    data: { revokedAt: currentDate() },
  });

  const requestedScopes =
    scopes && scopes.length > 0
      ? scopes.filter((s) => existing.scopes.includes(s))
      : existing.scopes;

  await prisma.oAuthToken.create({
    data: {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      clientId,
      userId: existing.userId,
      scopes: requestedScopes,
      resource: resource ?? existing.resource ?? null,
      expiresAt: dateAdd(currentDate(), TOKEN_EXPIRY_SECONDS),
    },
  });

  return {
    access_token: newAccessToken,
    token_type: "Bearer",
    expires_in: TOKEN_EXPIRY_SECONDS,
    refresh_token: newRefreshToken,
    scope: requestedScopes.join(" "),
  };
}

export async function verifyAccessToken(
  token: string,
): Promise<{ userId: string; scopes: string[] } | null> {
  if (!isOAuthAccessToken(token)) return null;

  const tokenRecord = await prisma.oAuthToken.findUnique({
    where: { accessToken: token },
  });

  if (!tokenRecord) return null;
  if (tokenRecord.revokedAt) return null;
  if (tokenRecord.expiresAt < currentDate()) return null;

  return {
    userId: tokenRecord.userId,
    scopes: tokenRecord.scopes,
  };
}

export async function revokeToken(
  clientId: string,
  token: string,
): Promise<void> {
  const tokenRecord = await prisma.oAuthToken.findFirst({
    where: {
      OR: [{ accessToken: token }, { refreshToken: token }],
      clientId,
    },
  });

  if (tokenRecord && !tokenRecord.revokedAt) {
    await prisma.oAuthToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: currentDate() },
    });
  }
}

export async function revokeUserClientTokens(
  clientId: string,
  userId: string,
): Promise<{ tokensRevoked: number; consentRemoved: boolean }> {
  const result = await prisma.oAuthToken.updateMany({
    where: {
      clientId,
      userId,
      revokedAt: null,
    },
    data: { revokedAt: currentDate() },
  });

  await prisma.oAuthConsent.deleteMany({
    where: { clientId, userId },
  });

  return {
    tokensRevoked: result.count,
    consentRemoved: true,
  };
}

export type UserOAuthConnection = {
  clientId: string;
  clientName: string;
  scopes: string[];
  consentedAt: Date;
  tokenCount: number;
};

export async function getUserOAuthConnections(
  userId: string,
): Promise<UserOAuthConnection[]> {
  const consents = await prisma.oAuthConsent.findMany({
    where: { userId },
    include: { client: true },
  });

  const tokens = await prisma.oAuthToken.findMany({
    where: {
      userId,
      revokedAt: null,
    },
    select: { clientId: true },
  });

  const tokenCounts = new Map<string, number>();
  for (const t of tokens) {
    tokenCounts.set(t.clientId, (tokenCounts.get(t.clientId) ?? 0) + 1);
  }

  return consents.map((c) => ({
    clientId: c.clientId,
    clientName: c.client.clientName,
    scopes: c.scopes,
    consentedAt: c.createdAt,
    tokenCount: tokenCounts.get(c.clientId) ?? 0,
  }));
}

export async function registerClient(
  info: {
    clientName: string;
    clientUri?: string;
    logoUri?: string;
    redirectUris: string[];
    grantTypes?: string[];
    responseTypes?: string[];
    scope?: string;
    tokenEndpointAuthMethod?: string;
  },
): Promise<OAuthClientInfo & { clientSecret?: string }> {
  const clientId = "mcp_" + crypto.randomBytes(16).toString("hex");
  const clientSecret = crypto.randomBytes(32).toString("hex");

  const client = await prisma.oAuthClient.create({
    data: {
      clientId,
      clientSecret,
      clientName: info.clientName,
      clientUri: info.clientUri ?? null,
      logoUri: info.logoUri ?? null,
      redirectUris: info.redirectUris,
      grantTypes: info.grantTypes ?? ["authorization_code", "refresh_token"],
      responseTypes: info.responseTypes ?? ["code"],
      scope: info.scope ?? SCOPES_SUPPORTED.join(" "),
      isPublic:
        info.tokenEndpointAuthMethod === "none" ||
        !info.tokenEndpointAuthMethod,
    },
  });

  return {
    clientId: client.clientId,
    clientSecret,
    clientName: client.clientName,
    clientUri: client.clientUri ?? undefined,
    logoUri: client.logoUri ?? undefined,
    redirectUris: client.redirectUris,
    grantTypes: client.grantTypes,
    responseTypes: client.responseTypes,
    scope: client.scope ?? undefined,
    isPublic: client.isPublic,
  };
}

export async function checkExistingConsent(
  clientId: string,
  userId: string,
  requiredScopes: string[],
): Promise<boolean> {
  const consent = await prisma.oAuthConsent.findUnique({
    where: { clientId_userId: { clientId, userId } },
  });

  if (!consent) return false;

  return requiredScopes.every((s) => consent.scopes.includes(s));
}

export async function recordConsent(
  clientId: string,
  userId: string,
  scopes: string[],
  approved: boolean,
): Promise<void> {
  if (!approved) {
    await prisma.oAuthConsent.deleteMany({
      where: { clientId, userId },
    });
    return;
  }

  await prisma.oAuthConsent.upsert({
    where: { clientId_userId: { clientId, userId } },
    update: { scopes, updatedAt: currentDate() },
    create: { clientId, userId, scopes },
  });
}

export function buildRedirectUri(
  baseUri: string,
  params: Record<string, string>,
): string {
  const url = new URL(baseUri);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}
