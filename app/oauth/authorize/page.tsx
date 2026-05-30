import { redirect } from "next/navigation";
import { getSession } from "@/lib/management";
import {
  getClient,
  validateAuthorizationRequest,
  createAuthorizationCode,
  buildRedirectUri,
  getRequestedScopes,
  checkExistingConsent,
  recordConsent,
} from "@/lib/oauth/server";
import { handleOAuthAuthorize } from "@/app/actions/oauth";
import { Button } from "@/components/ui/button";
import { SCOPES_SUPPORTED } from "@/lib/oauth/types";
import type { AuthorizationRequest } from "@/lib/oauth/types";

async function autoApprove(
  clientId: string,
  redirectUri: string,
  responseType: string,
  sessionUserId: string,
  scope?: string,
  state?: string,
  codeChallenge?: string,
  codeChallengeMethod?: string,
) {
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
  };

  const error = validateAuthorizationRequest(client, params);
  if (error) throw new Error(error);

  const code = await createAuthorizationCode(
    clientId,
    sessionUserId,
    params,
  );

  const scopes = getRequestedScopes(scope || undefined, client);
  await recordConsent(clientId, sessionUserId, scopes, true);

  const successParams: Record<string, string> = { code };
  if (state) successParams.state = state;

  redirect(buildRedirectUri(redirectUri, successParams));
}

export default async function OAuthAuthorizePage(props: {
  searchParams: Promise<{
    client_id?: string;
    redirect_uri?: string;
    response_type?: string;
    scope?: string;
    state?: string;
    code_challenge?: string;
    code_challenge_method?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  const {
    client_id,
    redirect_uri,
    response_type,
    scope,
    state,
    code_challenge,
    code_challenge_method,
  } = searchParams;

  if (!client_id || !redirect_uri || !response_type) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-xl font-bold">Invalid Request</h1>
          <p className="text-muted-foreground">
            Missing required OAuth parameters (client_id, redirect_uri,
            response_type).
          </p>
        </div>
      </div>
    );
  }

  const session = await getSession();

  const client = await getClient(client_id);
  if (!client) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-xl font-bold">Invalid Request</h1>
          <p className="text-muted-foreground">Unknown client_id</p>
        </div>
      </div>
    );
  }

  const authParams: AuthorizationRequest = {
    clientId: client_id,
    redirectUri: redirect_uri,
    responseType: response_type,
    scope: scope || undefined,
    state: state || undefined,
    codeChallenge: code_challenge || undefined,
    codeChallengeMethod: code_challenge_method || undefined,
  };

  const validationError = validateAuthorizationRequest(client, authParams);
  if (validationError) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-xl font-bold">Invalid Request</h1>
          <p className="text-muted-foreground">{validationError}</p>
        </div>
      </div>
    );
  }

  if (!session) {
    const redirectParam = `/oauth/authorize?client_id=${encodeURIComponent(client_id)}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=${encodeURIComponent(response_type)}${scope ? `&scope=${encodeURIComponent(scope)}` : ""}${state ? `&state=${encodeURIComponent(state)}` : ""}${code_challenge ? `&code_challenge=${encodeURIComponent(code_challenge)}` : ""}${code_challenge_method ? `&code_challenge_method=${encodeURIComponent(code_challenge_method)}` : ""}`;
    redirect(`/auth?redirect=${encodeURIComponent(redirectParam)}`);
  }

  const scopes = getRequestedScopes(scope || undefined, client);
  const hasConsent = await checkExistingConsent(
    client_id,
    session.user.id,
    scopes,
  );

  if (hasConsent) {
    await autoApprove(
      client_id,
      redirect_uri,
      response_type,
      session.user.id,
      scope,
      state,
      code_challenge,
      code_challenge_method,
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Authorize Access</h1>
          <p className="text-muted-foreground text-sm">
            <strong>{client.clientName}</strong> wants to access your Cashflow
            Tracker data
          </p>
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <p className="text-sm font-medium">This will allow the application to:</p>
          <ul className="space-y-2">
            {SCOPES_SUPPORTED.map((s) => (
              <li key={s} className="flex items-center gap-2 text-sm">
                <span className="size-1.5 rounded-full bg-primary shrink-0" />
                <span
                  className={
                    scopes.includes(s)
                      ? ""
                      : "text-muted-foreground line-through"
                  }
                >
                  {s === "cashflow:read"
                    ? "Read your cashflow entries and analytics"
                    : ""}
                  {s === "cashflow:write"
                    ? "Create, update, and delete entries"
                    : ""}
                  {!s.startsWith("cashflow:") ? s : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <form action={handleOAuthAuthorize} className="space-y-3">
          <input type="hidden" name="client_id" value={client_id} />
          <input type="hidden" name="redirect_uri" value={redirect_uri} />
          <input type="hidden" name="response_type" value={response_type} />
          {scope && <input type="hidden" name="scope" value={scope} />}
          {state && <input type="hidden" name="state" value={state} />}
          {code_challenge && (
            <input type="hidden" name="code_challenge" value={code_challenge} />
          )}
          {code_challenge_method && (
            <input
              type="hidden"
              name="code_challenge_method"
              value={code_challenge_method}
            />
          )}

          <Button
            type="submit"
            name="action"
            value="approve"
            className="w-full"
          >
            Approve
          </Button>
          <Button
            type="submit"
            name="action"
            value="deny"
            variant="outline"
            className="w-full"
          >
            Deny
          </Button>
        </form>
      </div>
    </div>
  );
}
