import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

export const SCOPES = {
  READ: "cashflow:read",
  WRITE: "cashflow:write",
  LIFEFLOW_READ: "lifeflow:read",
  LIFEFLOW_WRITE: "lifeflow:write",
} as const;

export const SCOPES_SUPPORTED = [SCOPES.READ, SCOPES.WRITE, SCOPES.LIFEFLOW_READ, SCOPES.LIFEFLOW_WRITE];

export const TOKEN_EXPIRY_SECONDS = 3600;
export const REFRESH_TOKEN_EXPIRY_SECONDS = 30 * 24 * 3600;
export const AUTH_CODE_EXPIRY_SECONDS = 600;

export interface OAuthClientInfo {
  clientId: string;
  clientSecret?: string;
  clientName: string;
  clientUri?: string;
  logoUri?: string;
  redirectUris: string[];
  grantTypes: string[];
  responseTypes: string[];
  scope?: string;
  isPublic: boolean;
}

export interface AuthorizationRequest {
  clientId: string;
  redirectUri: string;
  responseType: string;
  scope?: string;
  state?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  resource?: string;
}

export interface TokenRequest {
  grantType: "authorization_code" | "refresh_token" | "client_credentials";
  code?: string;
  redirectUri?: string;
  clientId?: string;
  clientSecret?: string;
  codeVerifier?: string;
  refreshToken?: string;
  scope?: string;
  resource?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export function isOAuthAccessToken(token: string): boolean {
  return token.startsWith("oat_");
}

export function createAuthInfo(
  userId: string,
  scopes: string[],
  token: string,
  expiresAt?: number,
): AuthInfo {
  return {
    token,
    clientId: userId,
    scopes,
    expiresAt,
  };
}

export function parseScopeString(scope?: string): string[] {
  if (!scope || scope.trim() === "") return [];
  return scope.split(/\s+/).filter(Boolean);
}
