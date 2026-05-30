import "server-only";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { cache } from "react";

export function isAdmin(email: string): boolean {
  const adminEmails = process.env.ADMIN_EMAILS?.split(",").map((e) => e.trim().toLowerCase()) ?? [];
  return adminEmails.includes(email.toLowerCase());
}

export const requireAdmin = cache(async () => {
  const hdrs = await headers();
  const session = await auth.api.getSession({ headers: hdrs });
  if (!session) throw new Error("Not authenticated");
  if (!isAdmin(session.user.email)) throw new Error("Forbidden: admin access required");
  return session;
});

export const isCurrentUserAdmin = cache(async () => {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
});
