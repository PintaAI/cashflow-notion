import { createHash, randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleError, ok } from "@/lib/api/helpers";
import { grantPromotionalEntitlement } from "@/lib/revenuecat";
import { reconcileBilling } from "@/lib/billing";
import { isRateLimited, requestIp } from "@/lib/rate-limit";

const PREMIUM_ENTITLEMENT_KEY = "premium";
function normalizeCode(code: string): string {
  return code.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
}

function hashCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return Response.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    }
    if (await isRateLimited(`billing:beta-redeem:${session.user.id}:${requestIp(request)}`, 5, 10 * 60)) {
      return Response.json({ error: "RATE_LIMITED" }, { status: 429 });
    }

    const enabled = process.env.BETA_REDEMPTION_ENABLED;
    if (enabled !== "true") {
      return Response.json({ error: "BETA_REDEMPTION_DISABLED" }, { status: 403 });
    }

    const deadline = process.env.BETA_REDEMPTION_DEADLINE;
    if (deadline && new Date() > new Date(deadline)) {
      return Response.json({ error: "BETA_REDEMPTION_DISABLED" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const rawCode = typeof body?.code === "string" ? body.code.trim() : "";
    if (!rawCode) {
      return Response.json({ error: "BETA_CODE_INVALID" }, { status: 400 });
    }

    const normalized = normalizeCode(rawCode);
    const codeHash = hashCode(normalized);

    const claimToken = `pending:${session.user.id}:${randomUUID()}`;
    const result = await prisma.$transaction(async (tx) => {
      const code = await tx.betaRedemptionCode.findUnique({
        where: { codeHash },
      });

      if (!code || code.revokedAt) {
        return { status: "invalid" as const };
      }
      if (code.expiresAt < new Date()) {
        return { status: "expired" as const };
      }
      if (code.redeemedByUserId) {
        if (code.redeemedByUserId === session.user.id && code.grantReference) {
          return { status: "already_redeemed_by_user" as const, grantReference: code.grantReference };
        }
        return { status: "already_redeemed" as const };
      }

      if (code.grantReference?.startsWith("pending:")) {
        return code.grantReference.startsWith(`pending:${session.user.id}:`)
          ? { status: "claimed" as const, codeId: code.id, claimToken: code.grantReference }
          : { status: "already_redeemed" as const };
      }

      const user = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { revenueCatAppUserId: true },
      });
      if (!user?.revenueCatAppUserId) {
        throw new Error("REVENUECAT_NOT_CONFIGURED");
      }

      const claimed = await tx.betaRedemptionCode.updateMany({
        where: { id: code.id, redeemedByUserId: null, grantReference: null },
        data: { grantReference: claimToken },
      });
      if (claimed.count !== 1) return { status: "already_redeemed" as const };

      return {
        status: "claimed" as const,
        codeId: code.id,
        claimToken,
        appUserId: user.revenueCatAppUserId,
      };
    });

    if (result.status === "invalid") {
      return Response.json({ error: "BETA_CODE_INVALID" }, { status: 400 });
    }
    if (result.status === "expired") {
      return Response.json({ error: "BETA_CODE_EXPIRED" }, { status: 400 });
    }
    if (result.status === "already_redeemed") {
      return Response.json({ error: "BETA_CODE_ALREADY_REDEEMED" }, { status: 409 });
    }
    if (result.status === "already_redeemed_by_user") {
      await reconcileBilling(session.user.id);
      return ok({ alreadyRedeemed: true, grantReference: result.grantReference });
    }

    if (result.status !== "claimed") {
      return Response.json({ error: "BETA_CODE_ALREADY_REDEEMED" }, { status: 409 });
    }

    const user = result.appUserId
      ? { revenueCatAppUserId: result.appUserId }
      : await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { revenueCatAppUserId: true },
        });
    if (!user?.revenueCatAppUserId) {
      throw new Error("REVENUECAT_NOT_CONFIGURED");
    }

    try {
      const grant = await grantPromotionalEntitlement(
        user.revenueCatAppUserId,
        PREMIUM_ENTITLEMENT_KEY,
        "lifetime",
      );
      const finalized = await prisma.betaRedemptionCode.updateMany({
        where: { id: result.codeId, grantReference: result.claimToken, redeemedByUserId: null },
        data: {
          redeemedByUserId: session.user.id,
          redeemedAt: new Date(),
          grantReference: grant.reference,
        },
      });
      if (finalized.count !== 1) throw new Error("Beta redemption claim was lost");
    } catch (error) {
      await prisma.betaRedemptionCode.updateMany({
        where: { id: result.codeId, grantReference: result.claimToken, redeemedByUserId: null },
        data: { grantReference: null },
      });
      throw error;
    }

    const status = await reconcileBilling(session.user.id);
    return ok(status);
  } catch (error) {
    return handleError(error);
  }
}
