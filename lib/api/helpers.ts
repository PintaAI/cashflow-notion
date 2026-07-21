import { auth } from "@/lib/auth";
import {
  checkPersonalCloudAccess,
  checkManagementCloudAccess,
} from "@/lib/cloud-access";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function cloudAccessErrorMeta(reason: string): { code: string; status: number; message: string } {
  switch (reason) {
    case "CLOUD_SYNC_REQUIRED":
      return { code: reason, status: 402, message: "Cloud sync requires premium subscription" };
    case "SHARED_WALLET_PREMIUM_INACTIVE":
      return { code: reason, status: 402, message: "Shared wallet sponsor subscription is inactive" };
    case "SHARED_WALLET_SPONSOR_INVALID":
      return { code: reason, status: 403, message: "Shared wallet sponsor is not a valid owner" };
    default:
      return { code: "BILLING_RECONCILIATION_FAILED", status: 503, message: reason };
  }
}

export class CloudAccessError extends Error {
  public readonly code: string;
  private readonly _reason: string;
  constructor(reason: string) {
    const meta = cloudAccessErrorMeta(reason);
    super(meta.message);
    this.name = "CloudAccessError";
    this.code = meta.code;
    this._reason = reason;
  }

  get status(): number {
    return cloudAccessErrorMeta(this._reason).status;
  }
}

export function ok<T>(data: T, status = 200): Response {
  return Response.json({ data }, { status });
}

export function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export type AuthenticatedSession = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>;

export async function requireSession(
  request: Request,
): Promise<AuthenticatedSession> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    throw new ApiError("Unauthorized", 401);
  }
  return session as AuthenticatedSession;
}

export function optionalSession(
  session: Awaited<ReturnType<typeof auth.api.getSession>> | null,
): session is AuthenticatedSession {
  return session !== null;
}

export async function handleError(
  error: unknown,
  defaultStatus = 500,
  defaultMessage = "Internal server error",
): Promise<Response> {
  if (error instanceof CloudAccessError) {
    return Response.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }

  if (error instanceof ApiError) {
    return errorResponse(error.message, error.status);
  }

  if (error instanceof Error) {
    const status = isClientError(error.message) ? 400 : defaultStatus;
    return errorResponse(error.message, status);
  }

  return errorResponse(defaultMessage, defaultStatus);
}

export async function requirePersonalCloudAccess(userId: string): Promise<void> {
  const result = await checkPersonalCloudAccess(userId);
  if (!result.allowed) {
    throw new CloudAccessError(result.reason);
  }
}

export async function requireManagementCloudAccess(
  userId: string,
  managementId: string,
): Promise<void> {
  const result = await checkManagementCloudAccess(userId, managementId);
  if (!result.allowed) {
    throw new CloudAccessError(result.reason);
  }
}

export async function resolveManagementIdAndCheckCloudAccess(
  request: Request,
  searchParams: URLSearchParams,
  resolveManagementId: (managementId?: string) => Promise<string>,
): Promise<string> {
  const session = await requireSession(request);
  const managementId = searchParams.get("management_id") ?? undefined;
  const resolvedId = await resolveManagementId(managementId);
  await requireManagementCloudAccess(session.user.id, resolvedId);
  return resolvedId;
}

function isClientError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("not found") ||
    lower.includes("invalid") ||
    lower.includes("cannot be empty") ||
    lower.includes("must be greater than") ||
    lower.includes("must be different") ||
    lower.includes("not authenticated") ||
    lower.includes("exceeded") ||
    lower.includes("too large")
  );
}
