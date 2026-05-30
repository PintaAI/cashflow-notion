"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/management";
import {
  getClient,
  validateAuthorizationRequest,
  createAuthorizationCode,
  buildRedirectUri,
  getRequestedScopes,
  recordConsent,
  getUserOAuthConnections,
  revokeUserClientTokens,
} from "@/lib/oauth/server";
import type { AuthorizationRequest } from "@/lib/oauth/types";

export async function handleOAuthAuthorize(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const clientId = formData.get("client_id") as string;
  const redirectUri = formData.get("redirect_uri") as string;
  const responseType = formData.get("response_type") as string;
  const scope = formData.get("scope") as string;
  const state = formData.get("state") as string;
  const codeChallenge = formData.get("code_challenge") as string;
  const codeChallengeMethod = formData.get("code_challenge_method") as string;
  const resource = formData.get("resource") as string;
  const action = formData.get("action") as string;

  const client = await getClient(clientId);
  if (!client) throw new Error("Invalid client");

  const params: AuthorizationRequest = {
    clientId,
    redirectUri,
    responseType,
    scope: scope || undefined,
    state: state || undefined,
    codeChallenge: codeChallenge || undefined,
    codeChallengeMethod: codeChallengeMethod || undefined,
    resource: resource || undefined,
  };

  const validationError = validateAuthorizationRequest(client, params);
  if (validationError) throw new Error(validationError);

  if (action !== "approve") {
    const errorParams: Record<string, string> = {
      error: "access_denied",
    };
    if (state) errorParams.state = state;
    redirect(buildRedirectUri(redirectUri, errorParams));
  }

  const code = await createAuthorizationCode(
    clientId,
    session.user.id,
    params,
  );

  const scopes = getRequestedScopes(scope || undefined, client);
  await recordConsent(clientId, session.user.id, scopes, true);

  const successParams: Record<string, string> = {
    code,
  };
  if (state) successParams.state = state;

  redirect(buildRedirectUri(redirectUri, successParams));
}

export async function listOAuthConnections() {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");
  return getUserOAuthConnections(session.user.id);
}

export async function revokeOAuthConnection(clientId: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");
  await revokeUserClientTokens(clientId, session.user.id);
}


