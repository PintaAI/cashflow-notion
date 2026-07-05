import { auth } from "@/lib/auth";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
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
  if (error instanceof ApiError) {
    return errorResponse(error.message, error.status);
  }

  if (error instanceof Error) {
    const status = isClientError(error.message) ? 400 : defaultStatus;
    return errorResponse(error.message, status);
  }

  return errorResponse(defaultMessage, defaultStatus);
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