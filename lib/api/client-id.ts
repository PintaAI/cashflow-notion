import { ApiError } from "@/lib/api/helpers";
import { Prisma } from "@prisma/client";

const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

export function optionalClientId(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || !CLIENT_ID_PATTERN.test(value)) {
    throw new ApiError("clientId is invalid", 400);
  }
  return value;
}

export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
